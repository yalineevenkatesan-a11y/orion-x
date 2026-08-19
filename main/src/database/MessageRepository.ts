import { DatabaseEngine } from "./DatabaseEngine";

export interface Message {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export class MessageRepository {
  private dbEngine: DatabaseEngine;

  constructor(dbEngine?: DatabaseEngine) {
    this.dbEngine = dbEngine || DatabaseEngine.getInstance();
  }

  async getMessagesByThread(threadId: string): Promise<Message[]> {
    const data = this.dbEngine.readData();
    return data.messages
      .filter((m: Message) => m.threadId === threadId)
      .sort((a: Message, b: Message) => a.timestamp - b.timestamp);
  }

  async saveMessage(message: Message): Promise<void> {
    const data = this.dbEngine.readData();
    if (!data.messages.some((m: any) => m.id === message.id)) {
      data.messages.push(message);
      this.dbEngine.writeData(data);
    }
    return Promise.resolve();
  }

  // Legacy mappings for WorkspaceService / other files
  async findByThreadId(threadId: string): Promise<any[]> {
    const messages = await this.getMessagesByThread(threadId);
    return messages.map(m => ({
      ...m,
      thread_id: m.threadId,
      created_at: m.timestamp
    }));
  }

  async create(entity: any): Promise<void> {
    const message: Message = {
      id: entity.id,
      threadId: entity.thread_id || entity.threadId,
      role: entity.role,
      content: entity.content,
      timestamp: entity.timestamp || Date.now()
    };
    await this.saveMessage(message);
  }
}
export default MessageRepository;
