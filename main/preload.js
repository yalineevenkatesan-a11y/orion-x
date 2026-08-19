// Preload script for ORION-X Studio
// Exposes safe APIs to the renderer process if needed in the future
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Add IPC communication bridges here as needed for desktop integration
});
