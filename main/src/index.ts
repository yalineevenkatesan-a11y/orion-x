import { app, BrowserWindow } from 'electron'; 
import path from 'path'; 
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

function createWindow(): void { 
  mainWindow = new BrowserWindow({ 
    width: 1200, 
    height: 800, 
    frame: true,       // CHANGED TO TRUE: Ensures the window outline shows up on your desktop
    transparent: false, // CHANGED TO FALSE: Prevents the window from being invisible
    show: true,         // CHANGED TO TRUE: Forces Electron to physically show it instantly
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
