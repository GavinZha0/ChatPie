-- Migration: Refactor agent table structure
-- This migration splits the instructions field into separate fields (role, system_prompt, tools, model)
-- for better data organization and querying

-- Add new columns (skip if already exists)
ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "role" varchar(32);
ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "system_prompt" text;
ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "tools" json;
ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "model" json NOT NULL DEFAULT '{}'::json;

--> statement-breakpoint
-- Migrate data from instructions to new columns (only if instructions column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agent' AND column_name = 'instructions'
  ) THEN
    UPDATE "agent"
    SET
      "role" = instructions->>'role',
      "system_prompt" = instructions->>'systemPrompt',
      "tools" = instructions->'mentions',
      "model" = COALESCE(instructions->'chatModel', '{}'::json)
    WHERE instructions IS NOT NULL;
  END IF;
END $$;

--> statement-breakpoint
-- Drop the old instructions column (only if it exists)
ALTER TABLE "agent" DROP COLUMN IF EXISTS "instructions";