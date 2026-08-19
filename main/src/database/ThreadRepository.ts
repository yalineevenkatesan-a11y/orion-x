import { DatabaseEngine, Thread } from "./DatabaseEngine";

export class ThreadRepository {
  private dbEngine: DatabaseEngine;

  constructor(dbEngine?: DatabaseEngine) {
    this.dbEngine = dbEngine || DatabaseEngine.getInstance();
  }

  async getThreadsByWorkspace(workspacePath: string): Promise<Thread[]> {
    const data = this.dbEngine.readData();
    const workspaceThreads = data.threads.filter((t: any) => t.workspacePath === workspacePath);
    
    if (workspaceThreads.length === 0) {
      const defaultThread: Thread = {
        id: "default-session",
        name: "Default Orion Workspace Session",
        createdAt: Date.now(),
        workspacePath: workspacePath,
        title: "Default Orion Workspace Session",
        created_at: Date.now()
      };

      await this.createThread(defaultThread);
      return [defaultThread];
    }
    
    return workspaceThreads.map((t: any) => ({
      ...t,
      title: t.name,
      created_at: t.createdAt
    }));
  }

  async createThread(thread: Thread): Promise<void> {
    const data = this.dbEngine.readData();
    if (!data.threads.some((t: any) => t.id === thread.id)) {
      data.threads.push(thread);
      this.dbEngine.writeData(data);
    }
    return Promise.resolve();
  }

  // Legacy mappings for WorkspaceService / other files
  async findById(id: string): Promise<Thread | null> {
    const data = this.dbEngine.readData();
    const thread = data.threads.find((t: any) => t.id === id);
    if (!thread) return null;
    return {
      ...thread,
      title: thread.name,
      created_at: thread.createdAt
    };
  }

  async findAll(): Promise<Thread[]> {
    const data = this.dbEngine.readData();
    return data.threads.map((t: any) => ({
      ...t,
      title: t.name,
      created_at: t.createdAt
    }));
  }

  async create(entity: any): Promise<void> {
    const thread: Thread = {
      id: entity.id,
      name: entity.title || entity.name || 'Untitled Workspace Session',
      createdAt: entity.created_at || entity.createdAt || Date.now(),
      workspacePath: entity.workspacePath || '',
      title: entity.title || entity.name || 'Untitled Workspace Session',
      created_at: entity.created_at || entity.createdAt || Date.now()
    };
    await this.createThread(thread);
  }

  async delete(id: string): Promise<void> {
    const data = this.dbEngine.readData();
    data.threads = data.threads.filter((t: any) => t.id !== id);
    data.messages = data.messages.filter((m: any) => m.threadId !== id);
    this.dbEngine.writeData(data);
    return Promise.resolve();
  }
}
export default ThreadRepository;
export type { Thread };
