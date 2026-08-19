export interface AIProvider {
  /**
   * Initializes the AI Provider execution loops.
   */
  initialize(): Promise<void>;

  /**
   * Queries and retrieves a list of locally available model names.
   */
  listModels(): Promise<string[]>;

  /**
   * Establishes a streaming connection to generate tokens for chat prompts.
   */
  streamInference(
    model: string,
    messages: Array<{ role: string; content: string }>,
    onToken: (chunk: string) => void
  ): Promise<void>;

  /**
   * Verifies that the local LLM server endpoint is online and responsive.
   */
  healthCheck(): Promise<boolean>;
}
