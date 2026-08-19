import { ipcMain } from 'electron';
import { ChatOrchestrator } from '../services/ChatOrchestrator';
import { ThreadRepository } from '../database/ThreadRepository';
import { MessageRepository } from '../database/MessageRepository';
import crypto from 'crypto';

export function initializeChatController(): void {
  const threadRepo = new ThreadRepository();
  const messageRepo = new MessageRepository();

  // Listen for prompt submissions from the renderer process
  ipcMain.on(
    'chat:submit',
    async (
      event,
      ...args: any[]
    ) => {
      let threadId = '';
      let messageId = '';
      let content = '';
      let model = '';

      // Support both object arguments or positional arguments
      if (args[0] && typeof args[0] === 'object' && 'threadId' in args[0]) {
        const payload = args[0];
        threadId = payload.threadId;
        messageId = payload.messageId;
        content = payload.content;
        model = payload.model;
      } else {
        threadId = args[0];
        messageId = args[1];
        content = args[2];
        model = args[3];
      }

      try {
        await ChatOrchestrator.processUserPrompt(
          threadId,
          messageId,
          content,
          model,
          (type, data) => {
            switch (type) {
              case 'chunk':
                // Send stream token delta back to renderer
                event.sender.send('chat:stream-chunk', data);
                break;
              case 'end':
                // Send stream end confirmation back to renderer
                event.sender.send('chat:stream-end', { assistantMessageId: data });
                break;
              case 'error':
                // Send stream error boundary back to renderer
                event.sender.send('chat:stream-error', data);
                break;
            }
          }
        );
      } catch (err: any) {
        console.error('Chat controller handler exception:', err);
        event.sender.send('chat:stream-error', err.message || String(err));
      }
    }
  );

  // Get active thread for workspace, creating one if not exists
  ipcMain.handle('chat:get-active-thread', async (_event, ...args: any[]) => {
    try {
      let workspaceId = '';
      if (args[0] && typeof args[0] === 'object' && 'workspaceId' in args[0]) {
        workspaceId = args[0].workspaceId;
      } else {
        workspaceId = args[0];
      }

      if (!workspaceId) {
        throw new Error('Workspace ID is required to resolve active chat thread');
      }

      // Query from JSON file repository
      const threads = await threadRepo.getThreadsByWorkspace(workspaceId);
      return threads[0];
    } catch (err) {
      console.error('Error in chat:get-active-thread handler:', err);
      throw err;
    }
  });

  // Get messages for a given thread
  ipcMain.handle('chat:get-messages', async (_event, ...args: any[]) => {
    try {
      let threadId = '';
      if (args[0] && typeof args[0] === 'object' && 'threadId' in args[0]) {
        threadId = args[0].threadId;
      } else {
        threadId = args[0];
      }

      if (!threadId) {
        return [];
      }

      // Query message history from JSON file repository
      return await messageRepo.findByThreadId(threadId);
    } catch (err) {
      console.error('Error in chat:get-messages handler:', err);
      throw err;
    }
  });

  // Save message to chat_messages table
  ipcMain.handle('chat:save-message', async (_event, ...args: any[]) => {
    try {
      let threadId = '';
      let role = '';
      let content = '';

      if (args[0] && typeof args[0] === 'object' && 'threadId' in args[0]) {
        const payload = args[0];
        threadId = payload.threadId;
        role = payload.role;
        content = payload.content;
      } else {
        threadId = args[0];
        role = args[1];
        content = args[2];
      }

      const messageId = `msg_${crypto.randomBytes(4).toString('hex')}`;
      await messageRepo.create({
        id: messageId,
        thread_id: threadId,
        role,
        content,
        timestamp: Date.now()
      });

      return {
        id: messageId,
        thread_id: threadId,
        role,
        content,
        created_at: new Date().toISOString()
      };
    } catch (err) {
      console.error('Error in chat:save-message handler:', err);
      throw err;
    }
  });
}
export default initializeChatController;
