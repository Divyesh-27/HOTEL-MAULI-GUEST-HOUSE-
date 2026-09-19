const fs = require('fs');
const path = require('path');
const initSqlJs = require(path.join(process.cwd(), 'node_modules', 'sql.js'));

async function runLoopholeTests() {
  console.log('====================================================');
  console.log('PART C & ADJACENT TEST SUITE: SECURITY & LOOPHOLES');
  console.log('====================================================');

  const DATA_DIR = path.join(process.env.APPDATA, 'hotel-mauli-guest-house');
  const BILLING_DIR = path.join(DATA_DIR, 'Billing');

  // Exact function from electron/main.cjs
  function getSafeBillingPdfPath(filename) {
    if (!filename || typeof filename !== 'string') return null;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return null;
    const safeName = path.basename(filename);
    if (!safeName || safeName === '.' || safeName === '..') return null;
    const resolvedBillingDir = path.resolve(BILLING_DIR);
    const resolvedPath = path.resolve(BILLING_DIR, safeName);
    if (resolvedPath !== resolvedBillingDir && !resolvedPath.startsWith(resolvedBillingDir + path.sep)) {
      return null;
    }
    return resolvedPath;
  }

  // --- LOOPHOLE TEST 1: Path Traversal Variants ---
  console.log('\n[TEST C.3] Path Traversal Attack Variants:');
  const attackVectors = [
    { input: '../../evil.txt', desc: 'Relative Unix traversal' },
    { input: '..\\..\\evil.txt', desc: 'Relative Windows traversal' },
    { input: 'C:\\Windows\\System32\\calc.exe', desc: 'Absolute Windows path' },
    { input: '/etc/shadow', desc: 'Absolute Unix path' },
    { input: '..%2f..%2fevil.txt', desc: 'URL-encoded traversal' },
    { input: 'invoice.pdf\0.exe', desc: 'Null byte injection' },
    { input: 'subdir/bill.pdf', desc: 'Subdirectory path' },
    { input: 'evil.exe', desc: 'Executable file without traversal' },
    { input: 'normal_bill_2026.pdf', desc: 'Legitimate bill PDF filename' },
  ];

  let traversalPassed = true;
  for (const vec of attackVectors) {
    const safePath = getSafeBillingPdfPath(vec.input);
    const canOpenPdf = Boolean(safePath && vec.input.toLowerCase().endsWith('.pdf'));
    const isMalicious = vec.input !== 'normal_bill_2026.pdf';
    
    // For evil.exe: safePath is accepted in BILLING_DIR, but canOpenPdf MUST be false!
    let passed = false;
    if (isMalicious) {
      if (vec.input === 'evil.exe') {
        passed = (!canOpenPdf); // Executable blocked by pdf:open check
      } else {
        passed = (safePath === null); // Traversal rejected
      }
    } else {
      passed = (safePath !== null && canOpenPdf === true);
    }

    if (!passed) traversalPassed = false;
    console.log(`  Vector: "${vec.input}" (${vec.desc}) -> safePath: ${safePath ? 'ALLOWED' : 'REJECTED'}, pdfOpen: ${canOpenPdf ? 'ALLOWED' : 'BLOCKED'} => [${passed ? 'PASS' : 'FAIL'}]`);
  }
  console.log(`Result: ${traversalPassed ? 'ALL TRAVERSAL VECTORS REJECTED' : 'FAIL'}`);

  // --- LOOPHOLE TEST 2: Orphaned Role ID RBAC ---
  console.log('\n[TEST C.4] Orphaned / Non-Existent Role ID RBAC:');
  const appRoles = [
    { id: 'role-admin', name: 'Admin', permissions: ['dashboard', 'registration', 'billing', 'calendar', 'history', 'revenue', 'admin', 'staff'] },
    { id: 'role-staff', name: 'Staff', permissions: ['dashboard', 'registration', 'billing', 'calendar'] }
  ];

  function evaluatePermissions(currentUser, roles) {
    let allowedPermissions = [];
    if (currentUser === 'master') {
      allowedPermissions = 'all';
    } else if (currentUser && typeof currentUser === 'object' && currentUser.roleId) {
      const role = roles.find(r => r.id === currentUser.roleId);
      allowedPermissions = role ? role.permissions : [];
    } else {
      allowedPermissions = [];
    }
    return allowedPermissions;
  }

  const orphanedUser = { id: 'user-orphaned', username: 'ghost', roleId: 'role-deleted-999' };
  const orphanedPermissions = evaluatePermissions(orphanedUser, appRoles);
  const nullUserPermissions = evaluatePermissions(null, appRoles);
  const undefinedUserPermissions = evaluatePermissions(undefined, appRoles);
  const masterPermissions = evaluatePermissions('master', appRoles);
  const staffPermissions = evaluatePermissions({ id: 'user-1', roleId: 'role-staff' }, appRoles);

  console.log('  Orphaned role user permissions:', JSON.stringify(orphanedPermissions), '->', orphanedPermissions.length === 0 ? 'PASS (0 permissions granted)' : 'FAIL');
  console.log('  Null user permissions:', JSON.stringify(nullUserPermissions), '->', nullUserPermissions.length === 0 ? 'PASS (0 permissions granted)' : 'FAIL');
  console.log('  Undefined user permissions:', JSON.stringify(undefinedUserPermissions), '->', undefinedUserPermissions.length === 0 ? 'PASS (0 permissions granted)' : 'FAIL');
  console.log('  Master user permissions:', masterPermissions, '->', masterPermissions === 'all' ? 'PASS' : 'FAIL');
  console.log('  Staff user permissions:', JSON.stringify(staffPermissions), '->', staffPermissions.length === 4 ? 'PASS' : 'FAIL');

  // --- LOOPHOLE TEST 3: SHA-256 Migration Transparency ---
  console.log('\n[TEST C.5] Password Migration & Upgraded Hash Re-verification:');
  const crypto = globalThis.crypto;
  const PBKDF2_ITERATIONS = 100000;
  const SALT_BYTES = 16;
  const KEY_BITS = 256;

  function bufToHex(buf) { return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join(''); }
  function hexToBuf(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    return bytes;
  }

  async function legacySha256(data) {
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', enc.encode(data));
    return bufToHex(new Uint8Array(hash));
  }

  async function hashPassword(password, customSaltHex) {
    const enc = new TextEncoder();
    const salt = customSaltHex ? hexToBuf(customSaltHex) : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, KEY_BITS);
    return 'pbkdf2:' + PBKDF2_ITERATIONS + ':' + bufToHex(salt) + ':' + bufToHex(new Uint8Array(bits));
  }

  async function verifyPassword(password, storedHash) {
    if (!password || !storedHash) return { valid: false, needsRehash: false };
    if (storedHash.startsWith('pbkdf2:')) {
      const parts = storedHash.split(':');
      const iter = parseInt(parts[1], 10);
      const salt = hexToBuf(parts[2]);
      const exp = parts[3];
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, KEY_BITS);
      const act = bufToHex(new Uint8Array(bits));
      let mismatch = 0;
      for (let i = 0; i < act.length; i++) mismatch |= act.charCodeAt(i) ^ exp.charCodeAt(i);
      return { valid: mismatch === 0, needsRehash: iter < PBKDF2_ITERATIONS };
    }
    const leg = await legacySha256(password);
    if (leg.toLowerCase() === storedHash.toLowerCase()) {
      return { valid: true, needsRehash: true, newHash: await hashPassword(password) };
    }
    return { valid: false, needsRehash: false };
  }

  // 1. Unmigrated user with old SHA-256
  const rawPassword = 'SecureStaffPassword2026!';
  const oldSha256 = await legacySha256(rawPassword);
  console.log('  1. Initial legacy SHA-256 hash:', oldSha256);

  // 2. First login: verify triggers migration
  const login1 = await verifyPassword(rawPassword, oldSha256);
  console.log('  2. First login verification:', { valid: login1.valid, needsRehash: login1.needsRehash });
  console.log('     New hash generated:', login1.newHash);

  // 3. Persist migrated hash
  const migratedHash = login1.newHash;

  // 4. Second login: verify with migrated PBKDF2 hash
  const login2 = await verifyPassword(rawPassword, migratedHash);
  console.log('  3. Second login (post-migration):', { valid: login2.valid, needsRehash: login2.needsRehash });

  // 5. Verify wrong password against migrated PBKDF2
  const loginWrong = await verifyPassword('WrongPassword123!', migratedHash);
  console.log('  4. Wrong password against PBKDF2:', { valid: loginWrong.valid });

  const cryptoPassed = login1.valid && login1.needsRehash && login2.valid && !login2.needsRehash && !loginWrong.valid;
  console.log(`Result: ${cryptoPassed ? 'PASS (Legacy migration & post-migration PBKDF2 flawless)' : 'FAIL'}`);
}

runLoopholeTests();
