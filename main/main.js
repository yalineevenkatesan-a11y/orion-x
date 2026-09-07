const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Remove any duplicate handler if already present
ipcMain.removeHandler('workspace:readFile');

ipcMain.handle('workspace:readFile', async (_event, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'Invalid file path' };
    }

    const target = path.resolve(filePath);
    if (!fs.existsSync(target)) {
      return { success: false, error: `Path does not exist: ${target}` };
    }

    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      // Return directory contents rather than crashing
      const entries = fs.readdirSync(target, { withFileTypes: true }).map(e => ({
        name: e.name,
        isDirectory: e.isDirectory(),
        path: path.join(target, e.name)
      }));
      return {
        success: true,
        isDirectory: true,
        entries,
        content: `// DIRECTORY: ${path.basename(target)}\n// Total items: ${entries.length}\n\n` +
                 entries.map(e => `${e.isDirectory ? '[DIR] ' : '      '}${e.name}`).join('\n')
      };
    }

    const ext = path.extname(target).slice(1).toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'];

    if (imageExtensions.includes(ext)) {
      const buffer = fs.readFileSync(target);
      return {
        success: true,
        isImage: true,
        isDirectory: false,
        base64: buffer.toString('base64'),
        mimeType: `image/${ext === 'svg' ? 'svg+xml' : ext}`
      };
    }

    const textContent = fs.readFileSync(target, 'utf-8');
    return {
      success: true,
      isImage: false,
      isDirectory: false,
      content: textContent
    };
  } catch (err) {
    return {
      success: false,
      error: err?.message || 'Failed to read path'
    };
  }
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: true,
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the Next.js development server
  mainWindow.loadURL('http://localhost:3000');

  // Open the DevTools in development if needed
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Disable hardware acceleration if transparency issues occur on certain GPU/OS
// app.disableHardwareAcceleration();

app.whenReady().then(() => {
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
