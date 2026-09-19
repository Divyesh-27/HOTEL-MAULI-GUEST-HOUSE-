/**
 * Secure cryptographic utilities for password hashing and verification.
 * Uses Web Crypto API PBKDF2 with 100,000 iterations of SHA-256 and a 16-byte random salt.
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

// Convert Uint8Array to hex string
function bufToHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Convert hex string to Uint8Array
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Computes raw legacy SHA-256 hash (for backwards compatibility migration).
 */
export async function legacySha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuf = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuf);
  return bufToHex(new Uint8Array(hashBuffer));
}

/**
 * Hashes a plaintext password using PBKDF2 with a random 16-byte salt and 100,000 iterations.
 * Format: `pbkdf2:100000:<saltHex>:<hashHex>`
 */
export async function hashPassword(password: string, customSaltHex?: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = customSaltHex ? hexToBuf(customSaltHex) : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const saltHex = bufToHex(salt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_BITS
  );

  const hashHex = bufToHex(new Uint8Array(derivedBits));
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltHex}:${hashHex}`;
}

export interface PasswordVerificationResult {
  valid: boolean;
  needsRehash: boolean;
  newHash?: string;
}

/**
 * Verifies a plaintext password against a stored hash.
 * Supports both new PBKDF2 format (`pbkdf2:<iterations>:<salt>:<hash>`)
 * and legacy SHA-256 format (64 hex characters) with automatic migration flag.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<PasswordVerificationResult> {
  if (!password || !storedHash) {
    return { valid: false, needsRehash: false };
  }

  // Case 1: PBKDF2 format
  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 4) {
      return { valid: false, needsRehash: false };
    }
    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const expectedHashHex = parts[3];

    if (!iterations || !saltHex || !expectedHashHex) {
      return { valid: false, needsRehash: false };
    }

    const encoder = new TextEncoder();
    const salt = hexToBuf(saltHex);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      KEY_BITS
    );

    const actualHashHex = bufToHex(new Uint8Array(derivedBits));
    
    // Constant-time check
    if (actualHashHex.length !== expectedHashHex.length) {
      return { valid: false, needsRehash: false };
    }
    let mismatch = 0;
    for (let i = 0; i < actualHashHex.length; i++) {
      mismatch |= actualHashHex.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
    }

    return {
      valid: mismatch === 0,
      needsRehash: iterations < PBKDF2_ITERATIONS,
    };
  }

  // Case 2: Legacy raw SHA-256 hash (64 hex characters)
  const legacyHash = await legacySha256(password);
  if (legacyHash.toLowerCase() === storedHash.toLowerCase()) {
    // Legacy match! Signal that this account must be migrated to PBKDF2
    const upgradedHash = await hashPassword(password);
    return {
      valid: true,
      needsRehash: true,
      newHash: upgradedHash,
    };
  }

  return { valid: false, needsRehash: false };
}
