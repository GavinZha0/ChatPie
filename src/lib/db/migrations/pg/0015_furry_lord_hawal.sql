CREATE TABLE "provider" (
	"id" serial PRIMARY KEY NOT NULL,
	"icon" varchar(32) NOT NULL,
	"name" varchar(32) NOT NULL,
	"base_url" varchar(128) NOT NULL,
	"api_key" text,
	"llm" json,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--> statement-breakpoint
-- Insert initial provider data
INSERT INTO "provider" ("icon", "name", "base_url", "api_key", "llm") VALUES
('openai', 'OpenAI', 'https://api.openai.com/v1', null, '[{"id": "gtp-4.1", "enabled": true, "temperature":0.3}, {"id": "gpt-5", "enabled":true, "temperature":0.3}, {"id": "gpt-5-mini", "enabled":false}, {"id": "o4-mini", "enabled":false}]'::json),
('anthropic', 'Anthropic', 'https://api.anthropic.com/v1', null, '[{"id": "claude-3", "enabled": false}, {"id": "sonnet-4", "enabled": false}]'::json),
('google', 'Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai', null, '[{"id": "gemini-2.0-flash", "enabled": false}, {"id": "gemini-3", "enabled": false}]'::json),
('xai', 'xAI', 'https://api.groq.com/openai/v1', null, '[{"id": "grok-4", "enabled": false}, {"id": "grok-3", "enabled": false}]'::json),
('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', null, '[{"id": "gpt-4o", "enabled": false}, {"id": "gpt-4.1", "enabled": false}]'::json),
('mistral', 'Mistral', 'https://api.mistral.ai/v1', null, '[{"id": "mistral-1.5", "enabled": false}, {"id": "mistral-2", "enabled": false}]'::json),
('nvidia', 'Nvidia', 'https://integrate.api.nvidia.com/v1', null, '[{"id": "nvidia-1", "enabled": false}, {"id": "nvidia-2", "enabled": false}]'::json),
('jina', 'Jina', 'https://api.jina.ai/v1', null, '[{"id": "jina-1", "enabled": false}, {"id": "jina-2", "enabled": false}]'::json),
('perplexity', 'Perplexity', 'https://api.perplexity.ai', null, null),
('ollama', 'Ollama', 'http://127.0.0.1:11434/v1', null, null),
('dify', 'Dify', 'http://127.0.0.1/v1', null, null),
('deepseek', 'Deepseek', 'https://api.deepseek.com/v1', null, '[{"id": "deepseek-r1", "enabled": false}, {"id": "deepseek-v3", "enabled": false}]'::json),
('qwen', 'Qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1', null, '[{"id": "qwen-3", "enabled": false}, {"id": "qwen-2.5", "enabled": false}]'::json),
('zhipu', 'Zhipu', 'https://open.bigmodel.cn/api/paas/v4', null, '[{"id": "zhipu-1", "enabled": false}, {"id": "zhipu-2", "enabled": false}]'::json),
('minimax', 'MiniMax', 'https://api.minimax.chat/v1', null, null),
('baichuan', 'Baichuan', 'https://api.baichuan-ai.com/v1', null, null),
('hunyuan', 'Hunyuan', 'https://api.hunyuan.cloud.tencent.com/v1', null, null),
('siliconloud', 'SiliconFlow', 'https://api.siliconflow.cn/v1', null, null),
('modelscope', 'Modelscope', 'https://api-inference.modelscope.cn/v1', null, null);
