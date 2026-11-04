ALTER TABLE "anime" ADD COLUMN "published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Titles that already exist stay visible. Only new titles start unpublished.
UPDATE "anime" SET "published" = true;