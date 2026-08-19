import { ThreadRepository, DbThread } from '../repositories/ThreadRepository';
import { MessageRepository, DbMessage } from '../repositories/MessageRepository';
import { Logger } from '../utils/Logger';

export class WorkspaceService {
  private static threadRepo = new ThreadRepository();
  private static messageRepo = new MessageRepository();

  /**
   * Inserts a new conversation thread session via the ThreadRepository.
   */
  public static async createThread(id: string, title: string): Promise<void> {
    Logger.getInstance().info('Database', `WorkspaceService createThread: "${title}" (${id})`);
    await this.threadRepo.create({
      id,
      title,
      created_at: Date.now(),
    });
  }

  /**
   * Retrieves all threads sorted by created_at in descending order.
   */
  public static async getThreads(): Promise<DbThread[]> {
    Logger.getInstance().info('Database', 'WorkspaceService getThreads: fetching all thread records');
    return this.threadRepo.findAll();
  }

  /**
   * Deletes a thread from store (foreign keys handle messages cascade).
   */
  public static async deleteThread(id: string): Promise<void> {
    Logger.getInstance().info('Database', `WorkspaceService deleteThread: removing thread ID: ${id}`);
    await this.threadRepo.delete(id);
  }

  /**
   * Inserts a new chat message associated with a thread session via the MessageRepository.
   */
  public static async addMessage(id: string, threadId: string, role: string, content: string): Promise<void> {
    Logger.getInstance().info('Database', `WorkspaceService addMessage: appending message role "${role}" in thread ${threadId}`);
    await this.messageRepo.create({
      id,
      thread_id: threadId,
      role,
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * Retrieves all messages belonging to a thread, sorted by timestamp in ascending order.
   */
  public static async getMessages(threadId: string): Promise<DbMessage[]> {
    Logger.getInstance().info('Database', `WorkspaceService getMessages: retrieving history for thread ${threadId}`);
    return this.messageRepo.findByThreadId(threadId);
  }
}
export type { DbThread, DbMessage };
