ALTER TABLE "agent" ADD COLUMN "role" varchar(32);
ALTER TABLE "agent" ADD COLUMN "system_prompt" text;
ALTER TABLE "agent" ADD COLUMN "tools" json;
ALTER TABLE "agent" ADD COLUMN "model" json NOT NULL DEFAULT '{}'::json;
UPDATE "agent"
SET
  "role" = instructions->>'role',
  "system_prompt" = instructions->>'systemPrompt',
  "tools" = instructions->'mentions',
  "model" = COALESCE(instructions->'chatModel', '{}'::json)
WHERE instructions IS NOT NULL;
ALTER TABLE "agent" DROP COLUMN "instructions";