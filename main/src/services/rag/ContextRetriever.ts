import { DatabaseEngine } from '../../database/DatabaseEngine';
import { VectorStoreMock, DbDocumentChunk } from './VectorStoreMock';
import { Logger } from '../../utils/Logger';

export interface DbAttachment {
  id: string;
  message_id: string;
  name: string;
  size: number;
  system_path: string;
  mime_type: string;
}

export class ContextRetriever {
  private vectorStore = new VectorStoreMock();

  /**
   * Scans associated attachments, runs a similarity lookup against stored blocks,
   * and formats an isolated markdown context summary block to embed into system prompts.
   */
  public async assembleContextPayload(threadId: string, promptText: string): Promise<string> {
    try {
      Logger.getInstance().info('LocalAI', `Assembling RAG context payload for thread: ${threadId}`);

      // 1. Scan attachments associated with this thread using JSON file queries
      const dbEngine = DatabaseEngine.getInstance();
      const data = dbEngine.readData();
      
      const messages = (data.messages || []).filter((m: any) => m.threadId === threadId || m.thread_id === threadId);
      const messageIds = new Set(messages.map((m: any) => m.id));

      const attachments = (data.attachments || []).filter((a: any) => messageIds.has(a.message_id));

      if (attachments.length === 0) {
        Logger.getInstance().info('LocalAI', 'No attachments found for this conversation session. Bypassing RAG context.');
        return '';
      }

      // 2. Extract keywords from the prompt text for matching search query
      const keywords = promptText
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter((word) => word.length > 4); // Filter out short helper words

      const searchTerms = keywords.length > 0 ? keywords.slice(0, 3) : [promptText.substring(0, 20)];

      // 3. Search database chunks matching keywords
      const matchedChunks: DbDocumentChunk[] = [];
      const seenChunkIds = new Set<string>();

      for (const term of searchTerms) {
        const results = await this.vectorStore.simulatedSimilaritySearch(term, 2);
        for (const chunk of results) {
          if (!seenChunkIds.has(chunk.id)) {
            seenChunkIds.add(chunk.id);
            matchedChunks.push(chunk);
          }
        }
      }

      if (matchedChunks.length === 0) {
        Logger.getInstance().info('LocalAI', 'No matching semantic chunks found for keywords. Bypassing context.');
        return '';
      }

      // 4. Assemble isolated markdown context summary block
      let payload = '\n\n### RETRIEVED WORKSPACE KNOWLEDGE CONTEXT\n';
      payload += 'Use the following local document chunks to ground your response:\n\n';

      for (const chunk of matchedChunks) {
        // Find matching attachment name
        const originAttachment = attachments.find((a: any) => a.id === chunk.attachment_id);
        const sourceName = originAttachment ? originAttachment.name : 'Unknown File';

        payload += `**Source: ${sourceName}** (Chunk index: ${chunk.chunk_index})\n`;
        payload += `\`\`\`text\n${chunk.content.trim()}\n\`\`\`\n\n`;
      }

      Logger.getInstance().info('LocalAI', `Injected ${matchedChunks.length} document chunks into the workspace context`);
      return payload;
    } catch (error) {
      Logger.getInstance().error('LocalAI', `ContextRetriever failure: ${error}`);
      return '';
    }
  }
}
export default ContextRetriever;
