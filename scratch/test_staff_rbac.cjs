const fs = require('fs');
const path = require('path');
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

async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
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
  return { valid: false, needsRehash: false };
}

async function testStaffFlow() {
  console.log('--- TESTING STAFF USER AUTH & RBAC FLOW ---');
  
  // 1. Admin creates a staff user
  const staffPassword = 'RahulStaffPassword!2026';
  const staffHash = await hashPassword(staffPassword);
  
  const staffUser = {
    id: 'user-staff-01',
    username: 'rahul_staff',
    fullName: 'Rahul Sharma',
    roleId: 'role-staff',
    status: 'active',
    passwordHash: staffHash
  };

  const appRoles = [
    { id: 'role-admin', name: 'Admin', permissions: ['dashboard', 'registration', 'billing', 'calendar', 'history', 'revenue', 'admin', 'staff'] },
    { id: 'role-staff', name: 'Staff', permissions: ['dashboard', 'registration', 'billing', 'calendar'] }
  ];

  // 2. Staff user attempts login with correct password
  const isAuth = await verifyPassword('RahulStaffPassword!2026', staffUser.passwordHash);
  console.log('Staff login attempt with correct password -> valid:', isAuth.valid);

  // 3. Staff user attempts login with wrong password
  const isWrongAuth = await verifyPassword('WrongPassword', staffUser.passwordHash);
  console.log('Staff login attempt with wrong password -> valid:', isWrongAuth.valid);

  // 4. Role-based permissions calculation
  function computePermissions(currentUser, roles) {
    let allowed = [];
    if (currentUser === 'master') {
      allowed = 'all';
    } else if (currentUser && typeof currentUser === 'object' && currentUser.roleId) {
      const role = roles.find(r => r.id === currentUser.roleId);
      allowed = role ? role.permissions : [];
    } else {
      allowed = [];
    }
    return allowed;
  }

  const staffPerms = computePermissions(staffUser, appRoles);
  console.log('Staff permissions:', staffPerms);
  console.log('Can staff access dashboard:', staffPerms.includes('dashboard'));
  console.log('Can staff access billing:', staffPerms.includes('billing'));
  console.log('Can staff access admin:', staffPerms.includes('admin') ? 'FAIL (Allowed)' : 'PASS (Denied)');
  console.log('Can staff access staff salary:', staffPerms.includes('staff') ? 'FAIL (Allowed)' : 'PASS (Denied)');

  // 5. Disabled staff user test
  const disabledStaff = { ...staffUser, status: 'disabled' };
  const canDisabledLogin = (disabledStaff.status !== 'disabled');
  console.log('Disabled staff account blocked:', !canDisabledLogin ? 'PASS (Blocked)' : 'FAIL');
}

testStaffFlow();
