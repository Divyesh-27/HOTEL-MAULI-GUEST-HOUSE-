/**
 * Local AES-256-GCM Aadhaar & Sensitive Data Vault
 * 
 * Rules:
 * - Stored under %APPDATA%/hotel-mauli-guest-house/vault/
 * - AES-256-GCM authenticated encryption (IV 12 bytes + Auth Tag 16 bytes + Ciphertext)
 * - Key derivation via scrypt with 32-byte cryptographically secure random salt
 * - Zero hardcoded passwords. Stores only salt and a verifier token HMAC.
 * - Auto-lock after 5 minutes of idle time and on app logout.
 * - Throttles after 5 consecutive failed unlock attempts.
 * - Full Aadhaar numbers, Aadhaar images, and profile photos stay strictly in the vault.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let VAULT_DIR = '';
let META_FILE = '';
let activeKey = null; // In-memory 32-byte derived key
let idleTimer = null;
let failedAttempts = 0;
let lockedUntil = 0;

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const VERIFIER_MESSAGE = 'HOTEL_MAULI_VAULT_TOKEN_V1';

function initVault(appDataDir) {
  VAULT_DIR = path.join(appDataDir, 'vault');
  META_FILE = path.join(VAULT_DIR, 'vault_meta.json');

  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
}

function getVaultDir() {
  return VAULT_DIR;
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  if (activeKey) {
    idleTimer = setTimeout(() => {
      lockVault();
    }, IDLE_TIMEOUT_MS);
  }
}

function isInitialized() {
  return fs.existsSync(META_FILE);
}

function isUnlocked() {
  return activeKey !== null;
}

function getStatus() {
  const now = Date.now();
  const isRateLimited = now < lockedUntil;
  return {
    initialized: isInitialized(),
    unlocked: isUnlocked(),
    failedAttempts,
    lockedUntil: isRateLimited ? lockedUntil : null,
    attemptsRemaining: Math.max(0, 5 - failedAttempts),
  };
}

function setupVault(password) {
  if (!password || typeof password !== 'string' || password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters long' };
  }

  if (isInitialized()) {
    return { success: false, error: 'Vault is already initialized' };
  }

  try {
    const salt = crypto.randomBytes(32);
    // scrypt key derivation: N=16384, r=8, p=1
    const key = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
    const verifier = crypto.createHmac('sha256', key).update(VERIFIER_MESSAGE).digest('hex');

    const meta = {
      salt: salt.toString('hex'),
      verifier,
      createdAt: new Date().toISOString(),
      version: 1,
    };

    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf8');

    activeKey = key;
    failedAttempts = 0;
    lockedUntil = 0;
    resetIdleTimer();

    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || 'Failed to initialize vault' };
  }
}

function unlockVault(password) {
  if (!isInitialized()) {
    return { success: false, error: 'Vault has not been set up yet' };
  }

  const now = Date.now();
  if (now < lockedUntil) {
    const seconds = Math.ceil((lockedUntil - now) / 1000);
    return { success: false, error: `Too many wrong attempts. Locked for ${seconds} more seconds.` };
  }

  try {
    const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
    const salt = Buffer.from(meta.salt, 'hex');
    const key = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
    const computedVerifier = crypto.createHmac('sha256', key).update(VERIFIER_MESSAGE).digest('hex');

    if (computedVerifier !== meta.verifier) {
      failedAttempts++;
      if (failedAttempts >= 5) {
        lockedUntil = Date.now() + 30000; // 30 second delay after 5 wrong attempts
        return { success: false, error: 'Incorrect password. Locked for 30 seconds due to 5 failed attempts.', attemptsRemaining: 0 };
      }
      return { success: false, error: 'Incorrect vault password', attemptsRemaining: 5 - failedAttempts };
    }

    activeKey = key;
    failedAttempts = 0;
    lockedUntil = 0;
    resetIdleTimer();

    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || 'Unlock error' };
  }
}

function lockVault() {
  activeKey = null;
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  return { success: true };
}

function saveRecord(recordId, data) {
  if (!activeKey) {
    return { success: false, error: 'Vault is locked. Unlock required.' };
  }

  if (!recordId) {
    return { success: false, error: 'Invalid record ID' };
  }

  resetIdleTimer();

  try {
    const plainText = Buffer.from(JSON.stringify(data), 'utf8');
    const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', activeKey, iv);

    const encrypted = Buffer.concat([cipher.update(plainText), cipher.final()]);
    const tag = cipher.getAuthTag(); // 16-byte GCM authentication tag

    // Wire format: [12 bytes IV] + [16 bytes Tag] + [Encrypted Payload]
    const packet = Buffer.concat([iv, tag, encrypted]);

    const filePath = path.join(VAULT_DIR, `${recordId}.enc`);
    fs.writeFileSync(filePath, packet);

    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || 'Failed to save encrypted record' };
  }
}

function getRecord(recordId) {
  if (!activeKey) {
    return { success: false, error: 'Vault is locked. Unlock required.' };
  }

  if (!recordId) {
    return { success: false, error: 'Invalid record ID' };
  }

  resetIdleTimer();

  try {
    const filePath = path.join(VAULT_DIR, `${recordId}.enc`);
    if (!fs.existsSync(filePath)) {
      return { success: true, data: null };
    }

    const packet = fs.readFileSync(filePath);
    if (packet.length < 28) {
      return { success: false, error: 'Corrupt vault record: payload too short' };
    }

    const iv = packet.subarray(0, 12);
    const tag = packet.subarray(12, 28);
    const encrypted = packet.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', activeKey, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const data = JSON.parse(decrypted.toString('utf8'));

    return { success: true, data };
  } catch (err) {
    return { success: false, error: 'Decryption failed or corrupted record' };
  }
}

function deleteRecord(recordId) {
  try {
    const filePath = path.join(VAULT_DIR, `${recordId}.enc`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || 'Failed to delete vault record' };
  }
}

module.exports = {
  initVault,
  getVaultDir,
  getStatus,
  setupVault,
  unlockVault,
  lockVault,
  resetIdleTimer,
  saveRecord,
  getRecord,
  deleteRecord,
};

