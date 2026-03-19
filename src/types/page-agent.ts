// Page Agent tool types
export interface PageAgentConfig {
  model: string;
  baseURL: string;
  apiKey: string;
  language?: "en-US" | "zh-CN";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PageAgentResult {
  success: boolean;
  history: Array<unknown>;
  data: string | unknown;
}
