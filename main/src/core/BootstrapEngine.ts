import fs from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { SystemConfig } from '../config/SystemConfig';
import { DatabaseEngine } from '../database/DatabaseEngine';
import { FileIngestor } from '../services/FileIngestor';

export class BootstrapEngine {
  /**
   * Initializes system folders and validates writability.
   * Creates directories recursively if they are missing.
   * Connects the SQLite database engine service.
   * Prepares the Local File Ingestion sandboxed directory.
   * Returns a boolean completion status flag.
   */
  public async initialize(): Promise<boolean> {
    const storagePath = SystemConfig.storagePath;

    try {
      // 1. Ensure directory structures are recursively created
      await fs.mkdir(storagePath, { recursive: true });

      // 2. Validate read/write access permissions on the directory
      await fs.access(storagePath, constants.R_OK | constants.W_OK);

      // 3. Perform an active write/delete loop test to guarantee write locks aren't holding
      const testFilePath = path.join(storagePath, '.orion_boot_session');
      await fs.writeFile(testFilePath, 'init_ok', 'utf8');
      await fs.unlink(testFilePath);

      // 4. Initialize and connect the Local SQLite database engine service layer
      await DatabaseEngine.getInstance().connect(storagePath);

      // 5. Initialize the Local File Ingestion sandbox directories
      await FileIngestor.getInstance().initialize();

      return true;
    } catch (error) {
      console.error('System bootstrap initialization failure:', error);
      return false;
    }
  }
}
