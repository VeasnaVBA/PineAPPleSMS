const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let isForceClose = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'SmartSchool — Offline School Management System',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#090d16',
    webPreferences: {
      preload: path.join(__dirname, 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Intercept window close to check for unsynced changes
  mainWindow.on('close', (e) => {
    if (isForceClose) return;

    e.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('check-unsynced-status');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Application Menu
function setupApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Print Report / Document',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow) mainWindow.webContents.print();
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

// Cloud Sync Network Request (Executed from Electron main process to bypass Chromium file:// CORS blocks)
ipcMain.handle('app:cloud-sync-request', async (_event, { endpoint, payload, timeoutMs = 45000 }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        return {
          success: false,
          error: 'Google Script Error 403 (បានបដិសេធការចូលប្រើប្រាស់): Web App មិនទាន់ត្រូវបានកំណត់ជា "Anyone" (អ្នកណាក៏ដោយ) នោះទេ។ Please set "Who has access" to "Anyone" in Google Apps Script Deployment.'
        };
      }
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {
      if (text.includes('Google Accounts') || text.includes('Service Login') || text.includes('Sign in')) {
        return {
          success: false,
          error: 'Google Script permission error: Web App is not set to "Anyone". Please redeploy with "Execute as: Me" and "Who has access: Anyone".'
        };
      }
      return {
        success: false,
        error: `Invalid response from Google Script: ${text.slice(0, 160)}...`
      };
    }

    return { success: true, data: json };
  } catch (err) {
    clearTimeout(timer);
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Connection timed out after 45 seconds.' : err.message
    };
  }
});

ipcMain.handle('app:print', async (_event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  return new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        silent: options.silent || false,
        printBackground: true,
        deviceName: options.deviceName || ''
      },
      (success, failureReason) => {
        if (!success) {
          resolve({ success: false, error: failureReason });
        } else {
          resolve({ success: true });
        }
      }
    );
  });
});

// Prompt Save Dialog for PDF and save directly to chosen file path
ipcMain.handle('app:save-pdf-dialog', async (_event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  try {
    const defaultFilename = options.defaultFilename || `report_${new Date().toISOString().slice(0, 10)}.pdf`;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: options.title || 'រក្សាទុករបាយការណ៍ជា PDF (Save Report as PDF)',
      defaultPath: path.join(app.getPath('documents'), defaultFilename),
      filters: [
        { name: 'PDF Document (*.pdf)', extensions: ['pdf'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    // Generate PDF buffer from webContents
    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      landscape: options.landscape || false,
      pageSize: options.pageSize || 'A4',
      margins: {
        marginType: 'none'
      }
    });

    await fs.promises.writeFile(filePath, pdfData);
    return { success: true, filePath };
  } catch (err) {
    console.error('Error in app:save-pdf-dialog:', err);
    return { success: false, error: err.message };
  }
});

// Prompt Open Dialog to select a destination directory on computer
ipcMain.handle('app:select-directory', async (_event, options = {}) => {
  if (!mainWindow) return { canceled: true };
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: options.title || 'ជ្រើសរើសទីតាំងថតឯកសារ (Select Destination Folder)',
      defaultPath: options.defaultPath || app.getPath('downloads'),
      properties: ['openDirectory', 'createDirectory']
    });
    return {
      canceled: result.canceled,
      filePaths: result.filePaths,
      selectedDirectory: result.filePaths && result.filePaths[0] ? result.filePaths[0] : null
    };
  } catch (err) {
    console.error('Error in app:select-directory:', err);
    return { canceled: true, error: err.message };
  }
});

// Save multiple files directly to selected directory (supports binary/base64 & utf8 text)
ipcMain.handle('app:save-files-to-directory', async (_event, { directoryPath, files }) => {
  try {
    const targetDir = directoryPath || app.getPath('downloads');
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }
    const saved = [];
    for (const file of (files || [])) {
      const fullPath = path.join(targetDir, file.filename);
      if (file.isBase64) {
        const buffer = Buffer.from(file.content, 'base64');
        await fs.promises.writeFile(fullPath, buffer);
      } else {
        await fs.promises.writeFile(fullPath, file.content, 'utf8');
      }
      saved.push({ filename: file.filename, fullPath });
    }
    return { success: true, directoryPath: targetDir, saved };
  } catch (err) {
    console.error('Error in app:save-files-to-directory:', err);
    return { success: false, error: err.message };
  }
});

// Open folder in native file explorer
ipcMain.handle('app:open-folder', async (_event, folderPath) => {
  try {
    if (folderPath && fs.existsSync(folderPath)) {
      await shell.openPath(folderPath);
      return { success: true };
    }
    return { success: false, error: 'Directory does not exist' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

// Check unsynced status response from renderer
ipcMain.on('unsynced-status-response', (_event, { hasUnsyncedChanges } = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (!hasUnsyncedChanges) {
    isForceClose = true;
    mainWindow.close();
    return;
  }

  // Instruct renderer to open the Save Changes dialog
  mainWindow.webContents.send('show-exit-save-modal');
});

// Force exit confirmed by user (either after sync or without saving)
ipcMain.on('confirm-exit-force', () => {
  isForceClose = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

// App Lifecycle
app.on('before-quit', (e) => {
  if (!isForceClose && mainWindow && !mainWindow.isDestroyed()) {
    e.preventDefault();
    mainWindow.close();
  }
});

app.whenReady().then(() => {
  setupApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});