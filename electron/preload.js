/**
 * Electron Secure Preload Script
 * Context Isolation: true, Node Integration: false
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  
  // App info
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  // Desktop native printing
  print: (options) => ipcRenderer.invoke('app:print', options),

  // Desktop native PDF export with Save File Dialog
  savePdfDialog: (options) => ipcRenderer.invoke('app:save-pdf-dialog', options),

  // Desktop native directory selection and batch file saving
  selectDirectory: (options) => ipcRenderer.invoke('app:select-directory', options),
  saveFilesToDirectory: (payload) => ipcRenderer.invoke('app:save-files-to-directory', payload),
  openFolder: (folderPath) => ipcRenderer.invoke('app:open-folder', folderPath),

  // Cloud sync native network request (bypasses Chromium file:// CORS blocks)
  cloudSyncRequest: (options) => ipcRenderer.invoke('app:cloud-sync-request', options),

  // Window management
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Close Interception & Sync Persistence
  onCheckUnsyncedStatus: (callback) => ipcRenderer.on('check-unsynced-status', (_event, ...args) => callback(...args)),
  sendUnsyncedStatusResponse: (data) => ipcRenderer.send('unsynced-status-response', data),
  onShowExitSaveModal: (callback) => ipcRenderer.on('show-exit-save-modal', (_event, ...args) => callback(...args)),
  confirmExitForce: () => ipcRenderer.send('confirm-exit-force')
});
