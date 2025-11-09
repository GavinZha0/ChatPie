// Provider and LLM model configuration types

export type LlmType = "chat" | "vision" | "audio" | "agent";

/**
 * LLM model configuration
 */
export interface LLMConfig {
  id: string;
  enabled: boolean;
  type: LlmType;
  functionCall: boolean;
  imageInput: boolean;
  contextLimit: number;
  description?: string;
  temperature?: number;
}

/**
 * Provider entity from database
 */
export interface Provider {
  id: number;
  name: string;
  alias: string;
  baseUrl: string;
  apiKey: string | null;
  llm: LLMConfig[] | null;
  updatedAt: Date;
}
