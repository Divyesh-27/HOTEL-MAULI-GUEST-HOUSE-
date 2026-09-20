const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Handle Windows Taskbar app grouping and icon issues
app.setAppUserModelId('com.hotelmauliguesthouse.app');

const isDev = !app.isPackaged;

// ============================================================
// AUTO-UPDATER (electron-updater)
// ============================================================
let mainWindow = null; // Reference to send IPC events to renderer
let isManualCheck = false; // Track whether the current check was manual
let updateCheckInterval = null;

function setupAutoUpdater() {
  // Only run auto-updater in production (packaged) builds
  if (isDev) {
    console.log('[Updater] Skipping auto-updater in dev mode.');
    return;
  }

  let autoUpdater;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (err) {
    console.error('[Updater] Failed to load electron-updater:', err);
    return;
  }

  // Configuration
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  // Logging
  autoUpdater.logger = {
    info: (...args) => console.log('[Updater]', ...args),
    warn: (...args) => console.warn('[Updater]', ...args),
    error: (...args) => console.error('[Updater]', ...args),
    debug: (...args) => console.log('[Updater:debug]', ...args),
  };

  // --- Event Handlers ---
  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for update...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-checking');
    }
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[Updater] Already on latest version:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-not-available', {
        version: info.version,
      });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent);
    console.log(`[Updater] Download progress: ${pct}%`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-download-progress', {
        percent: pct,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err?.message || err);
    // For automatic checks, fail silently (just log)
    // For manual checks, send error to renderer
    if (isManualCheck && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', {
        message: err?.message || 'Update check failed. Please check your internet connection.',
      });
    }
    isManualCheck = false;
  });

  // --- IPC Handlers ---
  ipcMain.handle('update:check', async () => {
    try {
      isManualCheck = true;
      const result = await autoUpdater.checkForUpdates();
      return { success: true, version: result?.updateInfo?.version };
    } catch (err) {
      isManualCheck = false;
      return { success: false, error: err?.message || 'Check failed' };
    }
  });

  ipcMain.handle('update:install', () => {
    // Save database before quitting for update
    saveDatabase();
    if (database) {
      try {
        database.close();
        console.log('[DB] SQLite closed before update install.');
      } catch (err) {
        console.error('[DB] Error closing SQLite before update:', err);
      }
    }
    // Quit and install — this replaces app code only, not %APPDATA% data
    autoUpdater.quitAndInstall(false, true);
  });

  // --- Automatic check schedule ---
  // First check: 10 seconds after launch
  setTimeout(() => {
    console.log('[Updater] Initial update check...');
    isManualCheck = false;
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[Updater] Initial check failed (silent):', err?.message);
    });
  }, 10000);

  // Periodic check: every 4 hours
  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
  updateCheckInterval = setInterval(() => {
    console.log('[Updater] Periodic update check...');
    isManualCheck = false;
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[Updater] Periodic check failed (silent):', err?.message);
    });
  }, FOUR_HOURS_MS);
}

// ============================================================
// PATHS
// ============================================================
const DATA_DIR = path.join(app.getPath('appData'), 'hotel-mauli-guest-house');
const DB_PATH = path.join(DATA_DIR, 'hotel_mauli.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const BILLING_DIR = path.join(DATA_DIR, 'Billing');
const STORE_KEY = 'mauli-guest-house-storage';

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
if (!fs.existsSync(BILLING_DIR)) fs.mkdirSync(BILLING_DIR, { recursive: true });

// ============================================================
// SQLITE DATABASE (sql.js — WASM-based, no native build)
// ============================================================
let database = null;

async function openDatabase() {
  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    // Load existing database file or create new one
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      database = new SQL.Database(fileBuffer);
      console.log('[DB] SQLite loaded from:', DB_PATH);
    } else {
      database = new SQL.Database();
      console.log('[DB] New SQLite database created.');
    }

    initSchema();
    saveDatabase(); // Persist to disk immediately after schema init
    return true;
  } catch (err) {
    console.error('[DB] Failed to open SQLite:', err);
    return false;
  }
}

function saveDatabase() {
  if (!database) return;
  try {
    const data = database.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('[DB] Failed to save database to disk:', err);
  }
}

// Auto-save every 10 seconds to prevent data loss on crash
let saveInterval = null;
function startAutoSave() {
  if (saveInterval) clearInterval(saveInterval);
  saveInterval = setInterval(() => {
    saveDatabase();
  }, 10000);
}

function initSchema() {
  if (!database) return;

  // Key-Value store for Zustand state persistence (replaces electron-store)
  database.run(`
    CREATE TABLE IF NOT EXISTS state_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Persistent synchronization queue
  database.run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      operation_id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      record_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      payload TEXT,
      timestamp TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'Pending',
      device TEXT DEFAULT 'desktop',
      checksum TEXT,
      error_message TEXT
    );
  `);

  // Synchronization logs (rotated automatically)
  database.run(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      module TEXT,
      record_id TEXT,
      operation TEXT,
      source_device TEXT,
      destination TEXT,
      result TEXT,
      retry_count INTEGER DEFAULT 0,
      duration_ms INTEGER,
      error_message TEXT
    );
  `);

  // Indexes for queue processing
  database.run(`CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_sync_logs_timestamp ON sync_logs(timestamp);`);

  console.log('[DB] Schema initialized.');
}

// ============================================================
// DATABASE BACKUP ENGINE
// ============================================================
function createBackup(reason = 'scheduled') {
  if (!fs.existsSync(DB_PATH)) return null;

  try {
    // Save current state to disk first
    saveDatabase();

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const backupName = `hotel_mauli_${ts}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    // Copy database file to backup
    fs.copyFileSync(DB_PATH, backupPath);

    // Verify backup integrity
    const stat = fs.statSync(backupPath);
    if (stat.size === 0) {
      fs.unlinkSync(backupPath);
      console.error('[Backup] Backup file is empty, removed:', backupPath);
      return null;
    }

    console.log(`[Backup] Created (${reason}): ${backupName} (${(stat.size / 1024).toFixed(1)} KB)`);
    return backupPath;
  } catch (err) {
    console.error('[Backup] Failed to create backup:', err);
    return null;
  }
}

function rotateBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('hotel_mauli_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time); // newest first

    if (files.length <= 7) return; // Keep at least 7

    const now = Date.now();
    const DAY = 86400000;
    const WEEK = 7 * DAY;
    const MONTH = 30 * DAY;

    const kept = new Set();

    // Keep daily backups for 7 days
    const dailyCutoff = now - 7 * DAY;
    for (const f of files) {
      if (f.time >= dailyCutoff) kept.add(f.name);
    }

    // Keep weekly backups for 4 weeks
    for (let w = 0; w < 4; w++) {
      const weekStart = now - (w + 1) * WEEK;
      const weekEnd = now - w * WEEK;
      const weekFile = files.find(f => f.time >= weekStart && f.time < weekEnd && !kept.has(f.name));
      if (weekFile) kept.add(weekFile.name);
    }

    // Keep monthly backups for 12 months
    for (let m = 0; m < 12; m++) {
      const monthStart = now - (m + 1) * MONTH;
      const monthEnd = now - m * MONTH;
      const monthFile = files.find(f => f.time >= monthStart && f.time < monthEnd && !kept.has(f.name));
      if (monthFile) kept.add(monthFile.name);
    }

    // Always keep the newest backup
    if (files.length > 0) kept.add(files[0].name);

    // Delete files not in the kept set
    for (const f of files) {
      if (!kept.has(f.name)) {
        try {
          fs.unlinkSync(f.path);
          console.log('[Backup] Rotated out:', f.name);
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error('[Backup] Rotation failed:', err);
  }
}

// ============================================================
// LEGACY DATA MIGRATION (from electron-store JSON to SQLite)
// ============================================================
function migrateLegacyDataIfNeeded() {
  if (!database) return;

  // Check if we already have data in SQLite
  const existingRows = database.exec('SELECT value FROM state_kv WHERE key = ?', [STORE_KEY]);
  if (existingRows.length > 0 && existingRows[0].values.length > 0) {
    console.log('[Migration] SQLite already has state data. Skipping legacy migration.');
    return;
  }

  // Try to load from electron-store JSON files
  let currentData = {};
  let currentState = {};
  let migrationHappened = false;

  // Try electron-store first
  try {
    const Store = require('electron-store');
    const store = new Store();
    currentData = store.get(STORE_KEY) || store.get('lodge-manager-storage') || {};
    currentState = currentData.state || {};
  } catch (e) {
    console.warn('[Migration] electron-store not available:', e.message);
  }

  const legacyPaths = [
    path.join(app.getPath('appData'), 'lodge-manager', 'config.json'),
    path.join(app.getPath('appData'), 'vite_react_shadcn_ts', 'config.json'),
  ];

  // Merge from legacy JSON files
  for (const legacyPath of legacyPaths) {
    if (fs.existsSync(legacyPath)) {
      try {
        const raw = fs.readFileSync(legacyPath, 'utf8');
        const parsed = JSON.parse(raw);
        const legacyState = parsed[STORE_KEY]?.state || parsed['lodge-manager-storage']?.state || parsed.state || parsed;

        if (legacyState && typeof legacyState === 'object') {
          for (const key of ['rooms', 'bookings', 'history', 'staff', 'staffLogs']) {
            if (Array.isArray(legacyState[key])) {
              const existing = currentState[key] || [];
              const existingIds = new Set(existing.map(item => item.id || item.roomNo || item.name));
              for (const item of legacyState[key]) {
                const itemId = item.id || item.roomNo || item.name;
                if (itemId && !existingIds.has(itemId)) {
                  existing.push(item);
                  existingIds.add(itemId);
                  migrationHappened = true;
                }
              }
              currentState[key] = existing;
            }
          }

          if (legacyState.roomStatus && typeof legacyState.roomStatus === 'object') {
            currentState.roomStatus = { ...legacyState.roomStatus, ...(currentState.roomStatus || {}) };
            migrationHappened = true;
          }
          if (legacyState.invoiceSettings && !currentState.invoiceSettings) {
            currentState.invoiceSettings = legacyState.invoiceSettings;
            migrationHappened = true;
          }
        }
      } catch (err) {
        console.error(`[Migration] Failed to read legacy file ${legacyPath}:`, err);
      }
    }
  }

  // If we have any data, migrate it to SQLite
  if (Object.keys(currentState).length > 0 || Object.keys(currentData).length > 0) {
    const payload = JSON.stringify({ state: currentState, version: currentData.version || 0 });
    database.run('INSERT OR REPLACE INTO state_kv (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))', [STORE_KEY, payload]);
    saveDatabase();
    console.log(`[Migration] Migrated state to SQLite (${(payload.length / 1024).toFixed(1)} KB). Legacy merge: ${migrationHappened}`);
  }
}

// ============================================================
// IPC HANDLERS
// ============================================================
function registerIpcHandlers() {

  // --- State Key-Value Storage (Zustand persistence) ---
  ipcMain.handle('db:get', (_event, key) => {
    if (!database) return null;
    try {
      const result = database.exec('SELECT value FROM state_kv WHERE key = ?', [key]);
      if (result.length > 0 && result[0].values.length > 0) {
        return JSON.parse(result[0].values[0][0]);
      }
      return null;
    } catch (err) {
      console.error('[IPC db:get] Error:', err);
      return null;
    }
  });

  ipcMain.handle('db:set', (_event, key, value) => {
    if (!database) return false;
    try {
      const json = JSON.stringify(value);
      database.run('INSERT OR REPLACE INTO state_kv (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))', [key, json]);
      // Don't saveDatabase() here on every write — let auto-save handle it for performance
      return true;
    } catch (err) {
      console.error('[IPC db:set] Error:', err);
      return false;
    }
  });

  ipcMain.handle('db:delete', (_event, key) => {
    if (!database) return false;
    try {
      database.run('DELETE FROM state_kv WHERE key = ?', [key]);
      return true;
    } catch (err) {
      console.error('[IPC db:delete] Error:', err);
      return false;
    }
  });

  ipcMain.handle('db:migrate', () => {
    migrateLegacyDataIfNeeded();
    return true;
  });

  // --- Sync Queue IPC ---
  ipcMain.handle('sync:enqueue', (_event, operation) => {
    if (!database) return false;
    try {
      database.run(`
        INSERT OR REPLACE INTO sync_queue (operation_id, module, record_id, operation_type, payload, timestamp, retry_count, status, device, checksum)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'Pending', ?, ?)
      `, [
        operation.operation_id,
        operation.module,
        operation.record_id,
        operation.operation_type,
        operation.payload ? JSON.stringify(operation.payload) : null,
        operation.timestamp || new Date().toISOString(),
        operation.device || 'desktop',
        operation.checksum || null
      ]);
      return true;
    } catch (err) {
      console.error('[IPC sync:enqueue] Error:', err);
      return false;
    }
  });

  ipcMain.handle('sync:getPending', () => {
    if (!database) return [];
    try {
      const result = database.exec("SELECT operation_id, module, record_id, operation_type, payload, timestamp, retry_count, status, device, checksum, error_message FROM sync_queue WHERE status IN ('Pending', 'Retrying') ORDER BY timestamp ASC LIMIT 50");
      if (result.length === 0) return [];
      const cols = result[0].columns;
      return result[0].values.map(row => {
        const obj = {};
        cols.forEach((col, i) => { obj[col] = row[i]; });
        if (obj.payload) {
          try { obj.payload = JSON.parse(obj.payload); } catch (e) {}
        }
        return obj;
      });
    } catch (err) {
      console.error('[IPC sync:getPending] Error:', err);
      return [];
    }
  });

  ipcMain.handle('sync:updateStatus', (_event, operationId, status, errorMessage) => {
    if (!database) return false;
    try {
      // Check if error is a deterministic 4xx client error (400, 401, 403, 404, 409, 422)
      let finalStatus = status;
      if (errorMessage && typeof errorMessage === 'string') {
        const lower = errorMessage.toLowerCase();
        if (
          lower.includes('400') ||
          lower.includes('401') ||
          lower.includes('403') ||
          lower.includes('404') ||
          lower.includes('409') ||
          lower.includes('422') ||
          lower.includes('deterministic') ||
          lower.includes('unauthorized') ||
          lower.includes('forbidden') ||
          lower.includes('not found') ||
          lower.includes('duplicate key') ||
          lower.includes('violates foreign key')
        ) {
          finalStatus = 'Failed'; // Stop retrying deterministic 4xx client errors
        }
      }

      if (finalStatus === 'Completed') {
        database.run('DELETE FROM sync_queue WHERE operation_id = ?', [operationId]);
      } else if (finalStatus === 'Retrying' || finalStatus === 'Failed') {
        database.run(
          'UPDATE sync_queue SET status = ?, retry_count = retry_count + 1, error_message = ? WHERE operation_id = ?',
          [finalStatus, errorMessage || null, operationId]
        );
      } else {
        database.run('UPDATE sync_queue SET status = ? WHERE operation_id = ?', [finalStatus, operationId]);
      }
      return true;
    } catch (err) {
      console.error('[IPC sync:updateStatus] Error:', err);
      return false;
    }
  });

  ipcMain.handle('sync:getQueueSize', () => {
    if (!database) return 0;
    try {
      const result = database.exec("SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('Pending', 'Retrying', 'Uploading')");
      return result.length > 0 ? result[0].values[0][0] : 0;
    } catch (err) {
      return 0;
    }
  });

  ipcMain.handle('sync:clearCompleted', () => {
    if (!database) return false;
    try {
      database.run("DELETE FROM sync_queue WHERE status = 'Completed'");
      return true;
    } catch (err) {
      return false;
    }
  });

  // --- Sync Log IPC ---
  ipcMain.handle('sync:addLog', (_event, log) => {
    if (!database) return false;
    try {
      database.run(`
        INSERT INTO sync_logs (timestamp, module, record_id, operation, source_device, destination, result, retry_count, duration_ms, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        log.timestamp || new Date().toISOString(),
        log.module, log.record_id, log.operation,
        log.source_device || 'desktop', log.destination || 'supabase',
        log.result, log.retry_count || 0, log.duration_ms || 0, log.error_message || null
      ]);
      return true;
    } catch (err) {
      return false;
    }
  });

  ipcMain.handle('sync:rotateLogs', () => {
    if (!database) return false;
    try {
      database.run("DELETE FROM sync_logs WHERE timestamp < datetime('now', '-30 days')");
      return true;
    } catch (err) {
      return false;
    }
  });

  // --- Backup IPC ---
  ipcMain.handle('db:backup', () => {
    return createBackup('manual');
  });

  ipcMain.handle('db:getBackups', () => {
    try {
      return fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('hotel_mauli_') && f.endsWith('.db'))
        .map(f => ({
          name: f,
          size: fs.statSync(path.join(BACKUP_DIR, f)).size,
          time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.toISOString(),
        }))
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    } catch (err) {
      return [];
    }
  });

  // Safe PDF Path Helper (Prevents Directory Traversal)
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

  // --- PDF IPC ---
  ipcMain.handle('pdf:generate', async (_event, filename, htmlContent) => {
    try {
      const filePath = getSafeBillingPdfPath(filename);
      if (!filePath) {
        console.error('[IPC pdf:generate] Invalid or traversing path rejected:', filename);
        return false;
      }
      
      // Create a hidden window to render the HTML
      let pdfWin = new BrowserWindow({
        width: 1000,
        height: 1200,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { margin: 0; padding: 0; background: white; font-family: sans-serif; }
              .pdf-container { width: 210mm; padding: 0; margin: 0; }
            </style>
          </head>
          <body>
            <div class="pdf-container">
              ${htmlContent}
            </div>
          </body>
        </html>
      `;
      
      await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      
      const pdfBuffer = await pdfWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { marginType: 'none' } // No margins, rely on the HTML padding
      });
      
      fs.writeFileSync(filePath, pdfBuffer);
      pdfWin.close();
      
      return true;
    } catch (err) {
      console.error('[IPC pdf:generate] Error:', err);
      return false;
    }
  });

  ipcMain.handle('pdf:save', (_event, filename, base64) => {
    try {
      const filePath = getSafeBillingPdfPath(filename);
      if (!filePath) {
        console.error('[IPC pdf:save] Path traversal rejected:', filename);
        return false;
      }
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(filePath, buffer);
      return true;
    } catch (err) {
      console.error('[IPC pdf:save] Error:', err);
      return false;
    }
  });

  ipcMain.handle('pdf:exists', (_event, filename) => {
    try {
      const filePath = getSafeBillingPdfPath(filename);
      if (!filePath) return false;
      return fs.existsSync(filePath);
    } catch (err) {
      return false;
    }
  });

  ipcMain.handle('pdf:open', async (_event, filename) => {
    try {
      if (typeof filename !== 'string' || !filename.toLowerCase().endsWith('.pdf')) {
        console.error('[IPC pdf:open] Non-PDF rejected:', filename);
        return false;
      }
      const filePath = getSafeBillingPdfPath(filename);
      if (!filePath) {
        console.error('[IPC pdf:open] Path traversal rejected:', filename);
        return false;
      }
      if (fs.existsSync(filePath)) {
        await shell.openPath(filePath);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[IPC pdf:open] Error:', err);
      return false;
    }
  });

  let activePrintPreviewWindow = null;

  ipcMain.handle('print:preview', (_event, htmlContent) => {
    // Before creating a new print-preview BrowserWindow, check for and close existing one
    if (activePrintPreviewWindow && !activePrintPreviewWindow.isDestroyed()) {
      try {
        activePrintPreviewWindow.close();
      } catch (err) {
        console.warn('[IPC print:preview] Failed to close previous window:', err);
      }
      activePrintPreviewWindow = null;
    }

    activePrintPreviewWindow = new BrowserWindow({
      width: 1000,
      height: 800,
      title: 'Print Preview',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    activePrintPreviewWindow.on('closed', () => {
      activePrintPreviewWindow = null;
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @media print {
              body { margin: 0; padding: 0; background: white !important; }
              .no-print { display: none !important; }
              .preview-container { box-shadow: none !important; margin: 0 !important; }
            }
            body { margin:0; background: #525659; display: flex; flex-direction: column; align-items: center; padding: 20px; font-family: sans-serif; }
            .preview-container { background: white; width: 210mm; min-height: 297mm; padding: 0; box-shadow: 0 0 10px rgba(0,0,0,0.5); margin-bottom: 20px; }
            .print-btn { position: fixed; top: 20px; right: 20px; padding: 12px 24px; font-size: 16px; cursor: pointer; background: #0ea5e9; color: white; border: none; border-radius: 6px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: background 0.2s; }
            .print-btn:hover { background: #0284c7; }
          </style>
        </head>
        <body>
          <div class="preview-container" id="printable-area">
            ${htmlContent}
          </div>
          <button class="no-print print-btn" onclick="window.print()">🖨️ Print</button>
        </body>
      </html>
    `;
    activePrintPreviewWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return true;
  });
}

// ============================================================
// WINDOW CREATION
// ============================================================
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'HOTEL MAULI GUEST HOUSE v1.4.0',
    icon: path.join(__dirname, '../build/icon.ico'),
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Store reference for auto-updater IPC
  mainWindow = win;

  win.once('ready-to-show', () => {
    win.show();
  });

  if (isDev) {
    win.loadURL('http://localhost:8080');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// ============================================================
// APP LIFECYCLE
// ============================================================
app.whenReady().then(async () => {
  // 1. Open SQLite database
  const dbOk = await openDatabase();

  if (dbOk) {
    // 2. Create startup backup
    createBackup('startup');

    // 3. Migrate legacy data (electron-store JSON → SQLite)
    migrateLegacyDataIfNeeded();

    // 4. Rotate old backups
    rotateBackups();

    // 5. Start auto-save timer
    startAutoSave();
  }

  // 6. Register IPC handlers
  registerIpcHandlers();

  // 7. Create the window
  createWindow();

  // 8. Setup auto-updater (checks for updates on launch + periodic)
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  // Stop auto-save and update check intervals
  if (saveInterval) clearInterval(saveInterval);
  if (updateCheckInterval) clearInterval(updateCheckInterval);

  // Final save to disk
  saveDatabase();

  // Safely close database before exit
  if (database) {
    try {
      database.close();
      console.log('[DB] SQLite closed cleanly.');
    } catch (err) {
      console.error('[DB] Error closing SQLite:', err);
    }
  }
  if (process.platform !== 'darwin') app.quit();
});