import { WorkspaceService } from './WorkspaceService';
import { OllamaProvider } from './OllamaProvider';
import { ContextRetriever } from './rag/ContextRetriever';
import { Logger } from '../utils/Logger';

export class ChatOrchestrator {
  private static contextRetriever = new ContextRetriever();

  /**
   * Processes a user prompt by running a database commit, context generation,
   * model streaming proxy, and a final database save of the accumulated reply.
   * Integrates local document chunk retrieval context injection dynamically.
   */
  public static async processUserPrompt(
    threadId: string,
    userMessageId: string,
    promptContent: string,
    model: string,
    eventEmitter: (type: 'chunk' | 'end' | 'error', data?: string) => void
  ): Promise<void> {
    try {
      // Step A: Save the clean User prompt into SQLite database
      await WorkspaceService.addMessage(userMessageId, threadId, 'user', promptContent);

      // Step B: Retrieve all historical messages for the threadId from SQLite
      const history = await WorkspaceService.getMessages(threadId);
      const context = history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Step C: Retrieve contextual local knowledge payload if files are attached
      const contextPayload = await this.contextRetriever.assembleContextPayload(threadId, promptContent);
      
      if (contextPayload && context.length > 0) {
        Logger.getInstance().info('LocalAI', 'Injecting document chunk context payload into LLM prompt stream');
        
        // Locate user's latest prompt in context and augment it with RAG context
        const latestUserMsg = context[context.length - 1];
        if (latestUserMsg.role === 'user') {
          latestUserMsg.content = `[SYSTEM DOCUMENT CONTEXT BUFFER]\nYou have access to the following sandboxed file text chunks relevant to the user's prompt:\n${contextPayload}\n-------------------------\nAnswer the user's inquiry strictly using the context blocks above whenever applicable.\n\nUser Query: ${latestUserMsg.content}`;
        }
      }

      // Step D: Forward augmented context to OllamaProvider and stream inference
      let accumulatedResponse = '';
      await OllamaProvider.getInstance().streamInference(
        model,
        context,
        (chunk: string) => {
          accumulatedResponse += chunk;
          eventEmitter('chunk', chunk);
        }
      );

      // Step E: Generate assistant message ID and commit complete response to database
      const assistantMessageId = `msg-${Date.now()}`;
      await WorkspaceService.addMessage(assistantMessageId, threadId, 'assistant', accumulatedResponse);

      // Notify caller of successful end
      eventEmitter('end', assistantMessageId);
    } catch (error: any) {
      Logger.getInstance().error('LocalAI', `ChatOrchestrator pipeline execution failure: ${error}`);
      eventEmitter('error', error.message || String(error));
    }
  }
}
