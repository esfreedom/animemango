DROP TABLE "ai_draft" CASCADE;--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "latest_aired_episode" integer;--> statement-breakpoint
DROP TYPE "public"."ai_draft_status";