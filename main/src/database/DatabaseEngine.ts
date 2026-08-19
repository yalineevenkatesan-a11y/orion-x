import * as fs from 'fs';
import * as path from 'path';

export interface Thread {
  id: string;
  name: string;
  createdAt: number;
  workspacePath: string;
  title: string;
  created_at: number;
}

export class DatabaseEngine {
  private static instance: DatabaseEngine | null = null;
  public isMock: boolean = true; 
  public db: any = { isJson: true }; // Enforces bypass of controller fallback checks
  private storagePath: string;

  constructor() {
    this.storagePath = path.join(
      process.env.USERPROFILE || process.env.HOME || '.', 
      'orion_studio_storage.json'
    );
  }

  /**
   * Returns the static DatabaseEngine singleton reference.
   */
  public static getInstance(): DatabaseEngine {
    if (!DatabaseEngine.instance) {
      DatabaseEngine.instance = new DatabaseEngine();
    }
    return DatabaseEngine.instance;
  }

  /**
   * Mounts the plain-text JSON state file.
   */
  async connect(dbPath?: string): Promise<void> {
    console.log(`[ORION-X] Internal JSON file storage mounted at: ${this.storagePath}`);
    if (!fs.existsSync(this.storagePath)) {
      const defaultState = { workspaces: [], threads: [], messages: [], settings: {}, document_chunks: [], attachments: [] };
      fs.writeFileSync(this.storagePath, JSON.stringify(defaultState, null, 2), 'utf-8');
    }
  }

  /**
   * Reads data from the plain-text JSON file.
   */
  public readData(): any {
    try {
      const content = fs.readFileSync(this.storagePath, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        workspaces: parsed.workspaces || [],
        threads: parsed.threads || [],
        messages: parsed.messages || [],
        settings: parsed.settings || {},
        document_chunks: parsed.document_chunks || [],
        attachments: parsed.attachments || []
      };
    } catch {
      return { workspaces: [], threads: [], messages: [], settings: {}, document_chunks: [], attachments: [] };
    }
  }

  /**
   * Writes data to the plain-text JSON file.
   */
  public writeData(data: any): void {
    try {
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error("[ORION-X] Storage write failure:", err);
    }
  }

  /**
   * Simulates DB disconnect cleanly.
   */
  public disconnect(): Promise<void> {
    return Promise.resolve();
  }
}
export default DatabaseEngine;
