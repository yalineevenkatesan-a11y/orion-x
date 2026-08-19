export interface ChunkResult {
  content: string;
  index: number;
}

export class TextChunker {
  /**
   * Divides incoming string content into 500-character segments overlapping by 100 characters.
   */
  public chunk(text: string): ChunkResult[] {
    const chunks: ChunkResult[] = [];
    const chunkSize = 500;
    const overlap = 100;
    const step = chunkSize - overlap; // 400 characters step

    let index = 0;

    for (let offset = 0; offset < text.length; offset += step) {
      const segment = text.substring(offset, offset + chunkSize);
      
      if (segment.trim()) {
        chunks.push({
          content: segment,
          index,
        });
        index++;
      }

      // Break early if we reached the absolute end of the document text
      if (offset + chunkSize >= text.length) {
        break;
      }
    }

    return chunks;
  }
}
