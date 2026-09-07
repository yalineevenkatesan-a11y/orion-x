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
      return await generateWorkspaceGraphData(directoryPath);
    } catch (err) {
      console.error('Failed to read directory graph:', err);
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
      const pathNode = require('path');
      try {
          const ext = pathNode.extname(filePath).toLowerCase();
          const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
          
          if (imageExts.includes(ext)) {
              const bitmap = fsNode.readFileSync(filePath);
              const base64 = Buffer.from(bitmap).toString('base64');
              const mimeType = ext === '.svg' ? 'svg+xml' : ext.replace('.', '');
              return `data:image/${mimeType};base64,${base64}`;
          }
          return fsNode.readFileSync(filePath, 'utf-8');
      } catch (e) {
          return "Error reading file stream.";
      }
  });
}

export interface GraphEdge {
  source: string;
  target: string;
  isCodeDependency?: boolean;
  type?: 'HIERARCHY' | 'IMPORT_DEPENDENCY' | string;
}

export async function generateWorkspaceGraphData(directoryPath: string): Promise<{ nodes: any[]; edges: GraphEdge[] }> {
  const fs = require('fs/promises');
  const path = require('path');
  const nodes: any[] = [];
  const edges: GraphEdge[] = [];
  const existingEdgeKeys = new Set<string>();

  async function walk(dir: string, parentId: string | null = null) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'out' || entry.name === '.next') continue;
        
        const fullPath = path.join(dir, entry.name);
        const id = fullPath;
        const isDir = entry.isDirectory();
        
        nodes.push({
          id,
          label: entry.name,
          type: isDir ? 'folder' : 'file',
          path: fullPath,
          relativePath: path.relative(directoryPath, fullPath) || entry.name,
          parentId,
          isDir,
          health: 'healthy'
        });
        
        if (parentId) {
          const edgeKey = `${parentId}->${id}`;
          if (!existingEdgeKeys.has(edgeKey)) {
            existingEdgeKeys.add(edgeKey);
            edges.push({
              source: parentId,
              target: id,
              isCodeDependency: false,
              type: 'HIERARCHY'
            });
          }
        }
        
        if (isDir) {
          await walk(fullPath, id);
        }
      }
    } catch (err) {
      console.warn(`[GraphWalker] Skipped directory: ${dir}`);
    }
  }

  if (directoryPath) {
    const rootName = path.basename(directoryPath) || directoryPath;
    nodes.push({
      id: directoryPath,
      label: rootName,
      type: 'folder',
      path: directoryPath,
      relativePath: '',
      parentId: null,
      isDir: true,
      health: 'healthy'
    });
    await walk(directoryPath, directoryPath);
  }

  // ---------------------------------------------------------
  // AST / Code-Level Import Dependency Parser
  // ---------------------------------------------------------
  function extractImports(fileContent: string, ext: string): string[] {
    const imports: string[] = [];
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      // 1. import ... from '...' or export ... from '...'
      const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(fileContent)) !== null) {
        if (match[1]) imports.push(match[1]);
      }
      // 2. require('...')
      const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = requireRegex.exec(fileContent)) !== null) {
        if (match[1]) imports.push(match[1]);
      }
      // 3. dynamic import('...')
      const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = dynamicImportRegex.exec(fileContent)) !== null) {
        if (match[1]) imports.push(match[1]);
      }
    } else if (ext === '.py') {
      // 1. from ... import ...
      const pyFromRegex = /from\s+([a-zA-Z0-9_\.]+)\s+import/g;
      let match;
      while ((match = pyFromRegex.exec(fileContent)) !== null) {
        if (match[1]) imports.push(match[1]);
      }
      // 2. import ...
      const pyImportRegex = /^\s*import\s+([a-zA-Z0-9_\.,\s]+)/gm;
      while ((match = pyImportRegex.exec(fileContent)) !== null) {
        const parts = match[1].split(',');
        for (const p of parts) {
          const cleaned = p.trim().split(/\s+as\s+/)[0].trim();
          if (cleaned) imports.push(cleaned);
        }
      }
    }
    return Array.from(new Set(imports));
  }

  const pathNormal = (p: string) => p.replace(/\\/g, '/').toLowerCase();

  const nodeByPath = new Map<string, any>();
  const nodeByBasename = new Map<string, any[]>();

  for (const n of nodes) {
    if (!n.isDir) {
      nodeByPath.set(pathNormal(n.path), n);
      const base = path.basename(n.path, path.extname(n.path)).toLowerCase();
      if (!nodeByBasename.has(base)) {
        nodeByBasename.set(base, []);
      }
      nodeByBasename.get(base)!.push(n);
    }
  }

  for (const node of nodes) {
    if (node.isDir) continue;
    const ext = path.extname(node.path).toLowerCase();
    if (!['.ts', '.tsx', '.js', '.jsx', '.py', '.mjs', '.cjs'].includes(ext)) continue;

    try {
      const content = await fs.readFile(node.path, 'utf-8');
      const rawImports = extractImports(content, ext);

      for (const imp of rawImports) {
        let targetNode: any = null;

        if (imp.startsWith('.')) {
          // Relative path resolution
          const dir = path.dirname(node.path);
          const resolved = path.resolve(dir, imp);
          const candidates = [
            resolved,
            `${resolved}.ts`,
            `${resolved}.tsx`,
            `${resolved}.js`,
            `${resolved}.jsx`,
            `${resolved}.d.ts`,
            `${resolved}.py`,
            path.join(resolved, 'index.ts'),
            path.join(resolved, 'index.tsx'),
            path.join(resolved, 'index.js'),
            path.join(resolved, 'index.jsx'),
            path.join(resolved, '__init__.py')
          ];
          for (const cand of candidates) {
            const found = nodeByPath.get(pathNormal(cand));
            if (found) {
              targetNode = found;
              break;
            }
          }
        } else if (imp.startsWith('@/') || imp.startsWith('~/')) {
          // Monorepo / alias path resolution
          const clean = imp.replace(/^[@~]\//, '');
          const candBases = [
            path.resolve(directoryPath, clean),
            path.resolve(directoryPath, 'src', clean),
            path.resolve(directoryPath, 'renderer', 'src', clean),
            path.resolve(directoryPath, 'main', 'src', clean)
          ];
          for (const candBase of candBases) {
            const candidates = [
              candBase,
              `${candBase}.ts`,
              `${candBase}.tsx`,
              `${candBase}.js`,
              `${candBase}.jsx`,
              path.join(candBase, 'index.ts'),
              path.join(candBase, 'index.tsx')
            ];
            for (const cand of candidates) {
              const found = nodeByPath.get(pathNormal(cand));
              if (found) {
                targetNode = found;
                break;
              }
            }
            if (targetNode) break;
          }
        } else if (ext === '.py') {
          // Python module resolution
          const asPath = imp.replace(/\./g, '/');
          const cand1 = path.resolve(path.dirname(node.path), asPath + '.py');
          const cand2 = path.resolve(directoryPath, asPath + '.py');
          targetNode = nodeByPath.get(pathNormal(cand1)) || nodeByPath.get(pathNormal(cand2));
        }

        // Basename fallback if no slash
        if (!targetNode && !imp.includes('/') && !imp.includes('\\')) {
          const matchingNodes = nodeByBasename.get(imp.toLowerCase());
          if (matchingNodes && matchingNodes.length === 1) {
            targetNode = matchingNodes[0];
          }
        }

        if (targetNode && targetNode.id !== node.id) {
          const edgeKey = `${node.id}->${targetNode.id}`;
          if (!existingEdgeKeys.has(edgeKey)) {
            existingEdgeKeys.add(edgeKey);
            edges.push({
              source: node.id,
              target: targetNode.id,
              isCodeDependency: true,
              type: 'IMPORT_DEPENDENCY'
            });
          }
        }
      }
    } catch {
      // Ignore unreadable files
    }
  }

  return { nodes, edges };
}

export default initializeFileController;
