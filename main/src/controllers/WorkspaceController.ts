import { ipcMain, dialog } from 'electron';
import { WorkspaceService } from '../services/WorkspaceService';
import { DatabaseEngine } from '../database/DatabaseEngine';
import crypto from 'crypto';
import { execSync } from 'child_process';

export interface OrionGraphNode {
  id: string;          
  name: string;        
  path: string;        
  type: 'file' | 'folder' | 'function' | 'class' | 'component' | 'dependency' | 'package' | 'config' | 'test' | 'documentation' | 'asset';
  extension: string;   
  parentId: string | null;
  childrenIds: string[];
  size: number;        
  LOC: number;         
  health: 'healthy' | 'warning' | 'critical' | 'unknown';
  risk: 'low' | 'medium' | 'high' | 'critical';
  complexity: { loc: number; functions: number; classes: number; imports: number; dependencies: number; score: number; };
  dependencies: string[]; 
  dependents: string[];   
  imports: string[];      
  importedBy: string[];
  issues: Array<{ id: string; type: string; severity: string; message: string; line?: number; }>;
  git: { status: 'added' | 'modified' | 'deleted' | 'renamed' | 'unchanged'; lastModified: string; author: string; ageDays: number; };
  label: string; 
  isDir: boolean;
  relativePath: string;
}

export function initializeWorkspaceController(): void {
  // Create a new thread
  ipcMain.handle('workspace:createThread', async (_event, ...args: any[]) => {
    let id = '';
    let title = '';

    if (args[0] && typeof args[0] === 'object' && 'id' in args[0]) {
      id = args[0].id;
      title = args[0].title;
    } else {
      id = args[0];
      title = args[1];
    }

    return WorkspaceService.createThread(id, title);
  });

  // Get all threads
  ipcMain.handle('workspace:getThreads', async () => {
    return WorkspaceService.getThreads();
  });

  // Delete a thread
  ipcMain.handle('workspace:deleteThread', async (_event, ...args: any[]) => {
    let id = '';
    if (args[0] && typeof args[0] === 'object' && 'id' in args[0]) {
      id = args[0].id;
    } else {
      id = args[0];
    }
    return WorkspaceService.deleteThread(id);
  });

  // Get all messages inside a thread
  ipcMain.handle('workspace:getMessages', async (_event, ...args: any[]) => {
    let threadId = '';
    if (args[0] && typeof args[0] === 'object' && 'threadId' in args[0]) {
      threadId = args[0].threadId;
    } else {
      threadId = args[0];
    }
    return WorkspaceService.getMessages(threadId);
  });

  // Add a message to a thread
  ipcMain.handle('workspace:addMessage', async (_event, ...args: any[]) => {
    let id = '';
    let threadId = '';
    let role = '';
    let content = '';

    if (args[0] && typeof args[0] === 'object' && 'id' in args[0]) {
      const payload = args[0];
      id = payload.id;
      threadId = payload.threadId;
      role = payload.role;
      content = payload.content;
    } else {
      id = args[0];
      threadId = args[1];
      role = args[2];
      content = args[3];
    }

    return WorkspaceService.addMessage(id, threadId, role, content);
  });

  // Open directory selection dialog
  ipcMain.handle('workspace:open-dialog', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    } catch (err) {
      console.error('Failed to show open dialog:', err);
      return null;
    }
  });

  // Register a new workspace in JSON file storage (with dynamic Git clone integration)
  ipcMain.handle('workspace:register-target', async (_event, ...args: any[]) => {
    let name = '';
    let pathVal = '';
    let gitUrl = '';

    if (args[0] && typeof args[0] === 'object' && 'name' in args[0]) {
      name = args[0].name;
      pathVal = args[0].path;
      gitUrl = args[0].gitUrl || '';
    } else {
      name = args[0];
      pathVal = args[1];
      gitUrl = args[2] || '';
    }

    try {
      const fs = require('fs/promises');
      const path = require('path');
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      // Intercept and auto-route Git cloning if a URL is detected
      if (gitUrl || pathVal.startsWith('http://') || pathVal.startsWith('https://')) {
        const targetUrl = gitUrl || pathVal;
        
        // Extract a clean repository name from the URL if not explicitly provided
        let repoName = name;
        if (!repoName) {
           const urlParts = targetUrl.split('/');
           repoName = urlParts[urlParts.length - 1].replace('.git', '');
        }

        const downloadBase = 'C:\\Users\\asus\\.gemini\\antigravity\\scratch\\orion-x-studio\\downloads\\cloned-repo';
        await fs.mkdir(downloadBase, { recursive: true });
        
        const targetClonePath = path.join(downloadBase, repoName);

        // Natively pull down the remote repository
        try {
          console.log(`[WorkspaceController] Executing dynamic clone: git clone ${targetUrl} ${targetClonePath}`);
          await execAsync(`git clone ${targetUrl} "${targetClonePath}"`);
        } catch (gitErr) {
          console.warn(`[WorkspaceController] Standard 'git' command failed. Falling back to absolute path execution...`, gitErr);
          await execAsync(`"C:\\Program Files\\Git\\cmd\\git.exe" clone ${targetUrl} "${targetClonePath}"`);
        }
        
        // Ensure our active pointer aligns directly with the new local folder
        pathVal = targetClonePath;
        name = repoName;
        gitUrl = targetUrl;
      }

      const id = `ws_${crypto.randomBytes(4).toString('hex')}`;
      const createdAt = Date.now();

      const dbEngine = DatabaseEngine.getInstance();
      const data = dbEngine.readData();
      
      const newWorkspace = {
        id,
        name,
        path: pathVal,
        git_url: gitUrl,
        created_at: createdAt
      };
      
      data.workspaces.push(newWorkspace);
      dbEngine.writeData(data);

      return {
        id,
        name,
        path: pathVal,
        gitUrl,
        createdAt,
      };
    } catch (err) {
      console.error('Failed to register workspace target:', err);
      throw err;
    }
  });
}
export default initializeWorkspaceController;
