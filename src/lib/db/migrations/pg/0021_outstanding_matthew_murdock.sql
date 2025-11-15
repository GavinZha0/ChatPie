CREATE TABLE "agent_group" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(32) NOT NULL,
	"agent_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"description" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_group" ADD CONSTRAINT "agent_group_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent" DROP COLUMN "llm_id";