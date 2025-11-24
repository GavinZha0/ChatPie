-- Migration: Add agent_group table
-- This migration adds the agent_group table to support group chat functionality

CREATE TABLE IF NOT EXISTS "agent_group" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"agent_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"description" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
-- Add foreign key constraint (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'agent_group_user_id_user_id_fk' 
    AND table_name = 'agent_group'
  ) THEN
    ALTER TABLE "agent_group" ADD CONSTRAINT "agent_group_user_id_user_id_fk" 
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
