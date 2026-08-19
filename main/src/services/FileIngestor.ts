import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { SystemConfig } from '../config/SystemConfig';
import { DatabaseEngine } from '../database/DatabaseEngine';

export interface DbAttachment {
  id: string;
  message_id: string;
  name: string;
  size: number;
  system_path: string;
  mime_type: string;
}

export class FileIngestor {
  private static instance: FileIngestor | null = null;
  private sandboxPath: string;

  private constructor() {
    this.sandboxPath = path.join(SystemConfig.storagePath, 'attachments_sandbox');
  }

  /**
   * Returns the static FileIngestor singleton reference.
   */
  public static getInstance(): FileIngestor {
    if (!FileIngestor.instance) {
      FileIngestor.instance = new FileIngestor();
    }
    return FileIngestor.instance;
  }

  /**
   * Ensures the attachments_sandbox sub-directory exists.
   */
  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.sandboxPath, { recursive: true });
    } catch (error) {
      console.error(`Failed to verify or create attachments sandbox path: ${this.sandboxPath}`, error);
      throw error;
    }
  }

  /**
   * Ingests a local file by copying it into the attachments_sandbox and recording details in the JSON database.
   */
  public async ingestFile(
    messageId: string,
    originalPath: string,
    fileName: string,
    fileModel: { size: number; type: string }
  ): Promise<void> {
    try {
      // 1. Verify original source file exists
      await fs.access(originalPath);

      // 2. Generate secure, collision-free filename identifier
      const fileExtension = path.extname(fileName);
      const uuidHash = crypto.randomBytes(16).toString('hex');
      const uniqueFileName = `file_${Date.now()}_${uuidHash}${fileExtension}`;
      const destinationPath = path.join(this.sandboxPath, uniqueFileName);

      // 3. Copy the file binary from original location into sandbox
      await fs.copyFile(originalPath, destinationPath);

      // 4. Commit metadata attributes to the attachments list inside JSON storage
      const attachmentId = `att-${Date.now()}-${crypto.randomInt(100, 999)}`;
      const dbEngine = DatabaseEngine.getInstance();
      const data = dbEngine.readData();

      const newAttachment: DbAttachment = {
        id: attachmentId,
        message_id: messageId,
        name: fileName,
        size: fileModel.size,
        system_path: destinationPath,
        mime_type: fileModel.type
      };

      data.attachments.push(newAttachment);
      dbEngine.writeData(data);
    } catch (error) {
      console.error(`FileIngestor ingestFile error for "${originalPath}":`, error);
      throw error;
    }
  }
}
export default FileIngestor;
