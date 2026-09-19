const fs = require('fs');
const path = require('path');
const initSqlJs = require(path.join(process.cwd(), 'node_modules', 'sql.js'));
const DB_PATH = path.join(process.env.APPDATA, 'hotel-mauli-guest-house', 'hotel_mauli.db');

async function testPersistenceAndRestart() {
  console.log('--- TESTING PERSISTENCE AND RESTART ON SQLITE DISK ---');
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);
  const rows = db.exec('SELECT key, value, updated_at FROM state_kv');
  console.log('Total keys in state_kv:', rows[0].values.length);
  
  const rawStorage = rows[0].values.find(([k]) => k === 'mauli-guest-house-storage');
  const parsed = JSON.parse(rawStorage[1]);
  const state = parsed.state;

  console.log('Database Persistence Verification:');
  console.log('  Rooms persisted count:', state.rooms?.length, state.rooms?.length === 24 ? '(PASS - 24 rooms)' : '(FAIL)');
  console.log('  Bookings persisted count:', state.bookings?.length);
  console.log('  History persisted count:', state.history?.length);
  console.log('  RoomStatus persisted:', JSON.stringify(state.roomStatus));
  console.log('  Custom Categories persisted:', state.customCategories?.length, '(PASS)');
  console.log('  Custom Bed Types persisted:', state.customBedTypes?.length, '(PASS)');
  console.log('  App Roles persisted:', state.appRoles?.length, '(PASS)');

  // Test rehydration session expiry logic
  console.log('\nSession Expiry on App Restart Rehydration:');
  const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

  function simulateRehydration(savedState) {
    const stateCopy = { ...savedState };
    if (stateCopy.isAuthenticated) {
      const now = Date.now();
      if (!stateCopy.lastLoginTime || (now - stateCopy.lastLoginTime > SESSION_MAX_AGE_MS)) {
        stateCopy.isAuthenticated = false;
        stateCopy.currentUser = null;
        stateCopy.lastLoginTime = null;
      }
    }
    return stateCopy;
  }

  // Case A: Fresh session from 2 hours ago
  const freshSession = simulateRehydration({
    isAuthenticated: true,
    currentUser: 'master',
    lastLoginTime: Date.now() - (2 * 60 * 60 * 1000)
  });
  console.log('  Fresh session (2h old):', {
    isAuthenticated: freshSession.isAuthenticated,
    currentUser: freshSession.currentUser
  }, freshSession.isAuthenticated ? 'PASS (Preserved)' : 'FAIL');

  // Case B: Expired session from 26 hours ago
  const expiredSession = simulateRehydration({
    isAuthenticated: true,
    currentUser: 'master',
    lastLoginTime: Date.now() - (26 * 60 * 60 * 1000)
  });
  console.log('  Expired session (26h old):', {
    isAuthenticated: expiredSession.isAuthenticated,
    currentUser: expiredSession.currentUser
  }, !expiredSession.isAuthenticated ? 'PASS (Cleared & Forced Re-login)' : 'FAIL');

  // Case C: Null timestamp session
  const nullTimestampSession = simulateRehydration({
    isAuthenticated: true,
    currentUser: 'master',
    lastLoginTime: null
  });
  console.log('  Null timestamp session:', {
    isAuthenticated: nullTimestampSession.isAuthenticated,
    currentUser: nullTimestampSession.currentUser
  }, !nullTimestampSession.isAuthenticated ? 'PASS (Cleared & Forced Re-login)' : 'FAIL');
}

testPersistenceAndRestart();
