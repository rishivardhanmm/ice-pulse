/**
 * Provider-agnostic AI contract. The app depends only on this, so swapping
 * OpenAI for Claude (or another provider) later is a single new implementation.
 */

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompleteOptions {
  /** System prompt (instructions + grounding rules). */
  system: string;
  /** Conversation messages (user/assistant turns). */
  messages: AiMessage[];
  /** Cap on output tokens (defaults to the configured AI_MAX_OUTPUT_TOKENS). */
  maxTokens?: number;
  /** Ask the model for a strict JSON object response. */
  json?: boolean;
}

export interface AiCompletion {
  text: string;
  model: string;
  usage: AiUsage;
}

export interface AiProvider {
  readonly name: string;
  complete(options: AiCompleteOptions): Promise<AiCompletion>;
}
