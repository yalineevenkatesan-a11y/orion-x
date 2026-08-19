import { ipcMain } from 'electron';
import { KnowledgeEngine } from '../services/KnowledgeEngine';
import { DatabaseEngine } from '../database/DatabaseEngine';

export interface LocalDocumentChunk {
  id: string;
  attachment_id: string;
  content: string;
  chunk_index: number;
  metadata: string;
}

export function initializeKnowledgeController(): void {
  // Handle requests to index document attachments into semantic chunks
  ipcMain.handle('knowledge:index', async (_event, ...args: any[]) => {
    let attachmentId = '';
    let filePath = '';

    // Support both positional and object arguments
    if (args[0] && typeof args[0] === 'object' && 'attachmentId' in args[0]) {
      const payload = args[0];
      attachmentId = payload.attachmentId;
      filePath = payload.filePath;
    } else {
      attachmentId = args[0];
      filePath = args[1];
    }

    await KnowledgeEngine.getInstance().processDocument(attachmentId, filePath);
  });

  // Query indexed chunks matching an attachment ID from JSON storage
  ipcMain.handle('knowledge:queryChunks', async (_event, ...args: any[]) => {
    let attachmentId = '';

    if (args[0] && typeof args[0] === 'object' && 'attachmentId' in args[0]) {
      attachmentId = args[0].attachmentId;
    } else {
      attachmentId = args[0];
    }

    try {
      const dbEngine = DatabaseEngine.getInstance();
      const data = dbEngine.readData();
      const chunks = data.document_chunks as LocalDocumentChunk[];

      const workspaceChunks = chunks
        .filter((c) => c.attachment_id === attachmentId)
        .sort((a, b) => a.chunk_index - b.chunk_index);

      return workspaceChunks;
    } catch (err) {
      console.error('Failed to query document chunks from JSON storage:', err);
      return [];
    }
  });
}
export default initializeKnowledgeController;
