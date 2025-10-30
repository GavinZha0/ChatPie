// Provider and LLM model configuration types

/**
 * LLM model configuration
 */
export interface LLMConfig {
  id: string;
  enabled: boolean;
  temperature?: number;
}

/**
 * Provider entity from database
 */
export interface Provider {
  id: number;
  icon: string;
  name: string;
  baseUrl: string;
  apiKey: string | null;
  llm: LLMConfig[] | null;
  updatedAt: Date;
}
