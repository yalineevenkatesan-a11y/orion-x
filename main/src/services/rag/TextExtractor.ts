import fs from 'fs/promises';

export class TextExtractor {
  /**
   * Reads target file content asynchronously and returns sanitized plain text.
   */
  public async extract(filePath: string): Promise<string> {
    try {
      // Safely handle asynchronous background physical file text collection routines
      const rawText = await fs.readFile(filePath, 'utf-8');
      
      // Sanitise plain text by removing null bytes or other non-printable anomalies if present
      return rawText.replace(/\0/g, '').trim();
    } catch (error) {
      console.error(`TextExtractor failure for path "${filePath}":`, error);
      throw error;
    }
  }
}
