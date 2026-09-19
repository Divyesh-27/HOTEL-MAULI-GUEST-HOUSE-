const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // --- State Key-Value Storage (Zustand persistence) ---
  get: (key) => ipcRenderer.invoke('db:get', key),
  set: (key, value) => ipcRenderer.invoke('db:set', key, value),
  delete: (key) => ipcRenderer.invoke('db:delete', key),
  migrate: () => ipcRenderer.invoke('db:migrate'),

  // --- Sync Queue ---
  syncEnqueue: (operation) => ipcRenderer.invoke('sync:enqueue', operation),
  syncGetPending: () => ipcRenderer.invoke('sync:getPending'),
  syncUpdateStatus: (operationId, status, errorMessage) => ipcRenderer.invoke('sync:updateStatus', operationId, status, errorMessage),
  syncGetQueueSize: () => ipcRenderer.invoke('sync:getQueueSize'),
  syncClearCompleted: () => ipcRenderer.invoke('sync:clearCompleted'),

  // --- Sync Logs ---
  syncAddLog: (log) => ipcRenderer.invoke('sync:addLog', log),
  syncRotateLogs: () => ipcRenderer.invoke('sync:rotateLogs'),

  // --- Backups ---
  backup: () => ipcRenderer.invoke('db:backup'),
  getBackups: () => ipcRenderer.invoke('db:getBackups'),

  // --- PDF & Print ---
  pdfGenerate: (filename, htmlContent) => ipcRenderer.invoke('pdf:generate', filename, htmlContent),
  pdfSave: (filename, base64) => ipcRenderer.invoke('pdf:save', filename, base64),
  pdfExists: (filename) => ipcRenderer.invoke('pdf:exists', filename),
  pdfOpen: (filename) => ipcRenderer.invoke('pdf:open', filename),
  printPreview: (htmlContent) => ipcRenderer.invoke('print:preview', htmlContent),

  // --- Auto-Updater ---
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateChecking: (cb) => ipcRenderer.on('update-checking', () => cb()),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_e, info) => cb(info)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', (_e, info) => cb(info)),
  onUpdateDownloadProgress: (cb) => ipcRenderer.on('update-download-progress', (_e, progress) => cb(progress)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_e, info) => cb(info)),
  onUpdateError: (cb) => ipcRenderer.on('update-error', (_e, err) => cb(err)),
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-checking');
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.removeAllListeners('update-download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('update-error');
  },
});