CREATE TABLE "llm" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"provider" varchar(32) NOT NULL,
	"type" varchar(32) DEFAULT 'chat' NOT NULL,
	"function_call" boolean DEFAULT true NOT NULL,
	"image_input" boolean DEFAULT false NOT NULL,
	"context_limit" integer DEFAULT 81920 NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);


INSERT INTO llm (id, provider, type, function_call, image_input, context_limit) VALUES
('gpt-5', 'openai', 'chat', true, true, 1024*1024),
('gpt-5-mini', 'openai', 'chat', true, true, 128*1024),
('gpt-4.1', 'openai', 'chat', true, true, 1024*1024),
('o4-mini', 'openai', 'chat', true, true, 128*1024),
('claude-3', 'anthropic','chat', true, false, 128*1024),
('sonnet-4.5', 'anthropic','chat', true, false, 128*1024),
('gemini-1.5', 'google', 'chat', true, true, 80*1024),
('gemini-pro', 'google','chat', true, true, 80*1024),
('grok-4', 'xAI','chat', true, true, 128*1024),
('gemma3:12b', 'ollama','chat', true, true, 80*1024),
('qwen3-14b:free', 'ollama','chat', true, false, 80*1024),
('mistral-small3.1:24b', 'ollama','chat', true, false, 80*1024),
('openai/gpt-oss-20b:free', 'openrouter','chat', true, false, 80*1024),
('z-ai/glm-4.5-air:free', 'openrouter','chat', true, false, 80*1024),
('minimax/minimax-m2:free', 'openrouter','chat', true, false, 80*1024);