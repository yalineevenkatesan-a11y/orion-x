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

    const BINARY_EXTENSIONS = new Set([
      'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg',
      'exe', 'dll', 'bin', 'zip', 'tar', 'gz', '7z',
      'mp3', 'mp4', 'wav', 'ogg', 'woff', 'woff2', 'ttf'
    ]);

    function getFileType(filePath) {
      const ext = (filePath.split('.').pop() || '').toLowerCase();
      if (ext === 'pdf') return 'pdf';
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg'].includes(ext)) return 'image';
      if (BINARY_EXTENSIONS.has(ext)) return 'binary';
      return 'text';
    }

    const fileType = getFileType(target);
    const fileName = path.basename(target);
    const ext = (target.split('.').pop() || '').toLowerCase();

    if (fileType === 'image') {
      const buffer = fs.readFileSync(target);
      return {
        success: true,
        fileType: 'image',
        isImage: true,
        isDirectory: false,
        fileName,
        fileSize: stat.size,
        base64: buffer.toString('base64'),
        mimeType: `image/${ext === 'svg' ? 'svg+xml' : ext}`,
        content: `// [IMAGE FILE: ${ext.toUpperCase()}]\n// File: ${fileName}\n// Size: ${(stat.size / 1024).toFixed(1)} KB`
      };
    }

    if (fileType === 'pdf') {
      return {
        success: true,
        fileType: 'pdf',
        isPdf: true,
        isBinary: true,
        isDirectory: false,
        fileName,
        fileSize: stat.size,
        content: `// [BINARY FILE: PDF DOCUMENT]\n// File: ${fileName}\n// Size: ${(stat.size / 1024).toFixed(1)} KB\n// Direct binary viewing disabled to prevent buffer corruption.`
      };
    }

    if (fileType === 'binary') {
      return {
        success: true,
        fileType: 'binary',
        isBinary: true,
        isDirectory: false,
        fileName,
        extension: ext,
        fileSize: stat.size,
        content: `// [BINARY ASSET: ${ext.toUpperCase() || 'COMPILED'}]\n// File: ${fileName}\n// Size: ${(stat.size / 1024).toFixed(1)} KB\n// Direct binary viewing disabled to prevent buffer corruption.`
      };
    }

    const textContent = fs.readFileSync(target, 'utf-8');
    return {
      success: true,
      fileType: 'text',
      isImage: false,
      isDirectory: false,
      fileName,
      fileSize: stat.size,
      content: textContent
    };
  } catch (err) {
    return {
      success: false,
      error: err?.message || 'Failed to read path'
    };
  }
});

ipcMain.removeHandler('workspace:openPath');
ipcMain.handle('workspace:openPath', async (_event, filePath) => {
  try {
    const { shell } = require('electron');
    if (filePath && shell) {
      return await shell.openPath(filePath);
    }
  } catch (e) {
    console.warn('Failed to open path:', e);
  }
  return false;
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
