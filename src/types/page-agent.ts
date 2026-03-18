// Page Agent tool types
export interface PageAgentConfig {
  model: string;
  baseURL: string;
  apiKey: string;
  language?: "en-US" | "zh-CN";
}

export interface PageAgentResult {
  success: boolean;
  history: any;
  data?: any;
}
