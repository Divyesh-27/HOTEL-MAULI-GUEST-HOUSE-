const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false });
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[BROWSER CONSOLE] ${message} (at ${sourceId}:${line})`);
  });
  
  win.webContents.on('did-fail-load', (e, errorCode, errorDescription) => {
    console.error(`[DID FAIL LOAD] ${errorDescription}`);
  });

  win.loadURL('http://localhost:8080').then(() => {
    console.log('[LOADED] URL');
    setTimeout(() => {
      app.quit();
    }, 3000);
  }).catch(err => {
    console.error('[LOAD ERROR]', err);
    app.quit();
  });
});
