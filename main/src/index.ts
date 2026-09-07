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
