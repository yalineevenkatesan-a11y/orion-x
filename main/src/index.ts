import { app, BrowserWindow, ipcMain } from 'electron'; 
import * as fs from 'fs';
import * as path from 'path'; 
import { BootstrapEngine } from './core/BootstrapEngine'; 
import { DatabaseEngine } from './database/DatabaseEngine'; 
import { initializeSettingsController } from './controllers/SettingsController'; 
import { initializeWorkspaceController } from './controllers/WorkspaceController'; 
import { initializeLocalAIController } from './controllers/LocalAIController'; 
import { initializeChatController } from './controllers/ChatController'; 
import { initializeFileController } from './controllers/FileController'; 
import { initializeKnowledgeController } from './controllers/KnowledgeController'; 
import { SettingsRegistry } from './services/SettingsRegistry'; 
import { Logger } from './utils/Logger'; 

// Remove any duplicate handler if already present
if (ipcMain && typeof ipcMain.removeHandler === 'function') {
  ipcMain.removeHandler('workspace:readFile');
}

const BINARY_EXTENSIONS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg', 'bmp', 'tiff',
  'exe', 'dll', 'bin', 'zip', 'tar', 'gz', '7z', 'rar', 'iso', 'dmg',
  'mp3', 'mp4', 'wav', 'ogg', 'mkv', 'avi', 'mov', 'webm',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt',
  'wasm', 'pyc', 'class', 'o', 'obj', 'so', 'dylib'
]);

function getFileType(filePath: string): 'pdf' | 'image' | 'binary' | 'text' {
  if (!filePath || typeof filePath !== 'string') return 'text';
  const ext = (filePath.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg', 'bmp'].includes(ext)) return 'image';
  if (BINARY_EXTENSIONS.has(ext)) return 'binary';
  return 'text';
}

if (ipcMain && typeof ipcMain.handle === 'function') {
  ipcMain.handle('workspace:readFile', async (_event, filePath: string) => {
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
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to read path'
    };
  }
  }); 
} 

Logger.getInstance().info('Kernel', 'ORION-X Studio Bootstrap Lifecycle Initiated Successfully'); 
let mainWindow: BrowserWindow | null = null; 
const bootstrap = new BootstrapEngine(); 

async function startApplication(): Promise<void> { 
  try {
    const isReady = await bootstrap.initialize(); 
    if (!isReady) { 
      Logger.getInstance().error('Kernel', 'Core Systems Bootstrap failure: Workspace path check or database load failed. Falling back to temporary memory storage.'); 
    }
  } catch (err) {
    Logger.getInstance().error('Kernel', `Storage file lock detected or mount failed: ${err}. Falling back to temporary memory storage.`);
  }
  try { 
    const activeEndpoint = await SettingsRegistry.get('ai_endpoint', null); 
    if (!activeEndpoint) { 
      await SettingsRegistry.set('ai_endpoint', 'http://localhost:11434'); 
      Logger.getInstance().info('Kernel', 'Ollama API target port initialized to default: http://localhost:11434'); 
    } 
  } catch (err) { 
    Logger.getInstance().error('Kernel', `Failed to initialize default Ollama endpoint setting: ${err}`); 
  } 
  createWindow(); 
} 

ipcMain.on('window-control', (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (action === 'minimize') win.minimize();
    if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
    if (action === 'close') win.close();
});

function createWindow(): void { 
  mainWindow = new BrowserWindow({ 
    width: 1200, 
    height: 800, 
    frame: false,
    autoHideMenuBar: true,
    transparent: false,
    show: true,
    webPreferences: { 
      nodeIntegration: false, 
      contextIsolation: true, 
      sandbox: true, 
      preload: path.join(__dirname, 'preload.js'), 
    }, 
  }); 

  // FORCED FIX: Bypass dev server and natively load the static production index HTML
  Logger.getInstance().info('Kernel', 'Loading static production asset build directly from renderer/out/index.html');
  mainWindow.loadFile(path.join(__dirname, '../../renderer/out/index.html')).catch((err) => {
    Logger.getInstance().error('Kernel', `Failed to load static index HTML file: ${err}`);
  });

  mainWindow.once('ready-to-show', () => { 
    if (mainWindow) { 
      mainWindow.show(); 
      mainWindow.focus(); 
    } 
  }); 

  mainWindow.on('closed', () => { 
    mainWindow = null; 
  }); 
} 

const gotTheLock = app.requestSingleInstanceLock(); 
if (!gotTheLock) { 
  app.quit(); 
} else { 
  app.on('second-instance', () => { 
    if (mainWindow) { 
      if (mainWindow.isMinimized()) mainWindow.restore(); 
      mainWindow.focus(); 
    } 
  }); 
  app.whenReady().then(() => { 
    initializeSettingsController(); 
    initializeWorkspaceController(); 
    initializeLocalAIController(); 
    initializeChatController(); 
    initializeFileController(); 
    initializeKnowledgeController(); 
    startApplication(); 
    app.on('activate', () => { 
      if (BrowserWindow.getAllWindows().length === 0) { 
        startApplication(); 
      } 
    }); 
  }); 
} 

app.on('window-all-closed', () => { 
  if (process.platform !== 'darwin') { 
    app.quit(); 
  } 
}); 

app.on('will-quit', async (event) => { 
  event.preventDefault(); 
  try { 
    await DatabaseEngine.getInstance().disconnect(); 
  } catch (err) { 
    Logger.getInstance().error('Kernel', `Database disconnection failed during application quit: ${err}`); 
  } 
  app.exit(0); 
});
