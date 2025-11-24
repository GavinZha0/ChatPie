-- Migration: Refactor agent table structure
-- This migration splits the instructions field into separate fields (role, system_prompt, tools, model)
-- for better data organization and querying

-- Add new columns
ALTER TABLE "agent" ADD COLUMN "role" varchar(32);
ALTER TABLE "agent" ADD COLUMN "system_prompt" text;
ALTER TABLE "agent" ADD COLUMN "tools" json;
ALTER TABLE "agent" ADD COLUMN "model" json NOT NULL DEFAULT '{}'::json;

--> statement-breakpoint
-- Migrate data from instructions to new columns
UPDATE "agent"
SET
  "role" = instructions->>'role',
  "system_prompt" = instructions->>'systemPrompt',
  "tools" = instructions->'mentions',
  "model" = COALESCE(instructions->'chatModel', '{}'::json)
WHERE instructions IS NOT NULL;

--> statement-breakpoint
-- Drop the old instructions column
ALTER TABLE "agent" DROP COLUMN "instructions";