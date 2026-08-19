import crypto from 'crypto';
import { DatabaseEngine } from '../../database/DatabaseEngine';

export interface DbDocumentChunk {
  id: string;
  attachment_id: string;
  content: string;
  chunk_index: number;
  metadata: string;
}

export class VectorStoreMock {
  /**
   * Commits structured document chunks to the plain-text JSON storage file.
   */
  public async storeChunks(
    attachmentId: string,
    chunks: Array<{ content: string; index: number }>
  ): Promise<void> {
    const dbEngine = DatabaseEngine.getInstance();
    const data = dbEngine.readData();

    for (const chunk of chunks) {
      const hash = crypto.randomBytes(8).toString('hex');
      const chunkId = `chk_${Date.now()}_${chunk.index}_${hash}`;
      
      const metadataPayload = {
        timestamp: Date.now(),
        charCount: chunk.content.length,
      };
      const metadataString = JSON.stringify(metadataPayload);

      const newChunk: DbDocumentChunk = {
        id: chunkId,
        attachment_id: attachmentId,
        content: chunk.content,
        chunk_index: chunk.index,
        metadata: metadataString
      };

      data.document_chunks.push(newChunk);
    }

    dbEngine.writeData(data);
    return Promise.resolve();
  }

  /**
   * Performs a programmatic keyword similarity filter lookup using clean JSON searches.
   */
  public async simulatedSimilaritySearch(query: string, limit: number = 3): Promise<DbDocumentChunk[]> {
    const dbEngine = DatabaseEngine.getInstance();
    const data = dbEngine.readData();
    const chunks = data.document_chunks as DbDocumentChunk[];

    const queryLower = query.toLowerCase();
    const matches = chunks
      .filter((c) => c.content.toLowerCase().includes(queryLower))
      .slice(0, limit);

    return Promise.resolve(matches);
  }
}
export default VectorStoreMock;
