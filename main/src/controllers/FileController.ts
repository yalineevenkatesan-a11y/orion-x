import { ipcMain } from 'electron';
import { FileIngestor, DbAttachment } from '../services/FileIngestor';
import { DatabaseEngine } from '../database/DatabaseEngine';

export function initializeFileController(): void {
  // Handle file ingest requests from renderer process
  ipcMain.handle('file:ingest', async (_event, ...args: any[]) => {
    let messageId = '';
    let originalPath = '';
    let name = '';
    let size = 0;
    let type = '';

    // Support both positional and object arguments
    if (args[0] && typeof args[0] === 'object' && 'messageId' in args[0]) {
      const payload = args[0];
      messageId = payload.messageId;
      originalPath = payload.originalPath;
      name = payload.name;
      size = payload.size;
      type = payload.type;
    } else {
      messageId = args[0];
      originalPath = args[1];
      name = args[2];
      size = args[3];
      type = args[4];
    }

    await FileIngestor.getInstance().ingestFile(messageId, originalPath, name, { size, type });
  });

  // Query attachments matching a target message ID from JSON storage
  ipcMain.handle('file:getAttachments', async (_event, ...args: any[]) => {
    let messageId = '';

    if (args[0] && typeof args[0] === 'object' && 'messageId' in args[0]) {
      messageId = args[0].messageId;
    } else {
      messageId = args[0];
    }

    try {
      const dbEngine = DatabaseEngine.getInstance();
      const data = dbEngine.readData();
      const attachments = data.attachments as DbAttachment[];

      return attachments.filter((a) => a.message_id === messageId);
    } catch (err) {
      console.error('Failed to get attachments from JSON storage:', err);
      return [];
    }
  });
  ipcMain.handle('fs:getGraphData', async (event, directoryPath: string) => {
    try {
      const fs = require('fs/promises');
      const path = require('path');
      const nodes: any[] = [];
      const edges: any[] = [];

      async function walk(dir: string, parentId: string | null = null) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'out') continue;
          
          const fullPath = path.join(dir, entry.name);
          const id = fullPath;
          const isDir = entry.isDirectory();
          
          nodes.push({
            id,
            label: entry.name,
            type: isDir ? 'folder' : 'file',
            path: fullPath,
            relativePath: entry.name,
            parentId,
            isDir,
            health: 'healthy'
          });
          
          if (parentId) {
            edges.push({
              source: parentId,
              target: id
            });
          }
          
          if (isDir) {
            await walk(fullPath, id);
          }
        }
      }
      
      if (directoryPath) {
        const rootName = path.basename(directoryPath) || directoryPath;
        nodes.push({
          id: directoryPath,
          label: rootName,
          type: 'folder',
          path: directoryPath,
          relativePath: rootName,
          parentId: null,
          isDir: true,
          health: 'healthy'
        });
        await walk(directoryPath, directoryPath);
      }
      
      return { nodes, edges };
    } catch (err) {
      console.error('Failed to read directory:', err);
      return { nodes: [], edges: [] };
    }
  });

  const fsNode = require('fs');
  const pathNode = require('path');
  function buildFileTree(dirPath: string): any {
      const stats = fsNode.statSync(dirPath);
      if (!stats.isDirectory()) {
          return { name: pathNode.basename(dirPath), type: 'file', path: dirPath };
      }
      const ignores = ['.git', 'node_modules', 'dist', '.next', 'out'];
      let children = [];
      try {
        children = fsNode.readdirSync(dirPath)
          .filter((child: string) => !ignores.includes(child))
          .map((child: string) => buildFileTree(pathNode.join(dirPath, child)));
      } catch (e) {}
      return { name: pathNode.basename(dirPath), type: 'dir', children, path: dirPath };
  }

  ipcMain.handle('fs:getTreeData', async (event, targetPath) => {
      // If frontend doesn't send a path, fallback directly to Downloads
      const finalPath = targetPath || 'C:\\Users\\asus\\Downloads';
      return buildFileTree(finalPath);
  });

  ipcMain.handle('fs:readFile', async (event, filePath) => {
      const fsNode = require('fs');
      try {
          return fsNode.readFileSync(filePath, 'utf-8');
      } catch (e) {
          return "Error reading file stream.";
      }
  });
}
export default initializeFileController;
