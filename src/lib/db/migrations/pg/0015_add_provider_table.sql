-- Migration: Add provider table with initial data
-- This migration adds the provider table to manage AI model providers

CREATE TABLE IF NOT EXISTS "provider" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"alias" varchar(32) NOT NULL,
	"base_url" varchar(128) NOT NULL,
	"api_key" text,
	"llm" json,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--> statement-breakpoint
-- Insert initial provider data with various AI providers (skip if already exists)
INSERT INTO "provider" ("name", "alias", "base_url", "api_key", "llm") 
SELECT * FROM (VALUES
('openai', 'OpenAI', 'https://api.openai.com/v1', null, '[{"id": "gtp-4.1", "type": "chat", "enabled": false}, {"id": "gpt-5", "type": "chat", "enabled":false}]'::json),
('anthropic', 'Anthropic', 'https://api.anthropic.com/v1', null, '[{"id": "claude-sonnet-4-5", "type": "chat", "enabled": false}]'::json),
('google', 'Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai', null, '[{"id": "gemini-2.0-flash", "type": "vision", "enabled": false}, {"id": "gemini-3-pro-preview", "type": "chat", "enabled": false}]'::json),
('xai', 'xAI', 'https://api.groq.com/openai/v1', null, '[{"id": "grok-4", "type": "chat", "enabled": false}]'::json),
('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', null, '[{"id": "openai/gpt-oss-20b:free", "type": "chat", "enabled": false}, {"id": "deepseek/deepseek-chat-v3.1:free", "type": "chat", "enabled": false}]'::json),
('groq', 'Groq', 'https://api.groq.com/openai/v1', null, '[{"id": "openai/gpt-oss-20b", "type": "chat", "enabled": false}]'::json),
('mistral', 'Mistral', 'https://api.mistral.ai/v1', null, '[{"id": "mistral-large-latest", "type": "chat", "enabled": false}]'::json),
('nvidia', 'Nvidia', 'https://integrate.api.nvidia.com/v1', null, '[{"id": "nim", "type": "chat", "enabled": false}]'::json),
('perplexity', 'Perplexity', 'https://api.perplexity.ai', null, '[{"id": "sonar-pro", "type": "chat", "enabled": false}]'::json),
('ollama', 'Ollama', 'http://127.0.0.1:11434/api', null, '[{"id": "qwen3:14b", "type": "chat", "enabled": false}, {"id": "gpt-oss:20b", "type": "chat", "enabled": false}]'::json),
('dify', 'Dify', 'http://127.0.0.1/v1', null, null),
('deepseek', 'Deepseek', 'https://api.deepseek.com/v1', null, '[{"id": "deepseek-r1", "type": "chat", "enabled": false}, {"id": "deepseek-v3", "type": "chat", "enabled": false}]'::json),
('qwen', 'Qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1', null, '[{"id": "qwen-v3-max", "type": "chat", "enabled": false}]'::json),
('zhipu', 'Zhipu', 'https://open.bigmodel.cn/api/paas/v4', null, '[{"id": "glm-4-plus", "type": "chat", "enabled": false}]'::json),
('exa', 'Exa Search', 'https://api.exa.ai', null, null)
) AS new_providers("name", "alias", "base_url", "api_key", "llm")
WHERE NOT EXISTS (SELECT 1 FROM "provider" LIMIT 1);
