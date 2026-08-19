import { TextExtractor } from './rag/TextExtractor';
import { TextChunker } from './rag/TextChunker';
import { VectorStoreMock } from './rag/VectorStoreMock';
import { Logger } from '../utils/Logger';

export class KnowledgeEngine {
  private static instance: KnowledgeEngine | null = null;
  
  private extractor = new TextExtractor();
  private chunker = new TextChunker();
  private store = new VectorStoreMock();

  private constructor() {}

  /**
   * Returns the static KnowledgeEngine singleton reference.
   */
  public static getInstance(): KnowledgeEngine {
    if (!KnowledgeEngine.instance) {
      KnowledgeEngine.instance = new KnowledgeEngine();
    }
    return KnowledgeEngine.instance;
  }

  /**
   * Facade method orchestrating document text extraction, sliding-window chunking,
   * and vector database storage. Registers milestones via Logger.ts.
   */
  public async processDocument(attachmentId: string, filePath: string): Promise<void> {
    try {
      Logger.getInstance().info('Database', `KnowledgeEngine: Initiating index task for file: ${filePath}`);

      // 1. Asynchronously read raw text block
      const rawText = await this.extractor.extract(filePath);
      Logger.getInstance().info('Database', `KnowledgeEngine: Text extracted successfully (${rawText.length} characters)`);

      // 2. Divide text into semantic overlapping segments
      const chunkedSegments = this.chunker.chunk(rawText);
      Logger.getInstance().info('Database', `KnowledgeEngine: Text divided into ${chunkedSegments.length} sliding window chunks`);

      // 3. Commit chunks into database document_chunks table
      await this.store.storeChunks(attachmentId, chunkedSegments);
      Logger.getInstance().info('Database', `KnowledgeEngine: Indexing process completed for attachment: ${attachmentId}`);
    } catch (error) {
      Logger.getInstance().error('Database', `KnowledgeEngine: Document processing failed for "${filePath}": ${error}`);
      throw error;
    }
  }
}
