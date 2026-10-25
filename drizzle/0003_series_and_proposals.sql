CREATE TYPE "public"."entry_kind" AS ENUM('tv', 'movie', 'ova', 'special');--> statement-breakpoint
CREATE TYPE "public"."proposal_kind" AS ENUM('metadata', 'grouping', 'season_label', 'availability', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'approved', 'rejected', 'applied');--> statement-breakpoint
CREATE TABLE "proposal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "proposal_kind" NOT NULL,
	"anime_id" uuid,
	"series_id" uuid,
	"payload" jsonb NOT NULL,
	"sources" jsonb NOT NULL,
	"ai_model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"auto_applied" boolean DEFAULT false NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title_romaji" text NOT NULL,
	"anilist_root_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_slug_unique" UNIQUE("slug"),
	CONSTRAINT "series_anilist_root_id_unique" UNIQUE("anilist_root_id")
);
--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "entry_kind" "entry_kind" DEFAULT 'tv' NOT NULL;--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "season_label" text;--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_availability" ADD COLUMN "covers_all_episodes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_availability" ADD COLUMN "episode_from" integer;--> statement-breakpoint
ALTER TABLE "platform_availability" ADD COLUMN "episode_to" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_audio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_sub" text;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposal_status_kind_idx" ON "proposal" USING btree ("status","kind");--> statement-breakpoint
CREATE INDEX "proposal_anime_idx" ON "proposal" USING btree ("anime_id");--> statement-breakpoint
ALTER TABLE "anime" ADD CONSTRAINT "anime_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anime_series_idx" ON "anime" USING btree ("series_id");--> statement-breakpoint
INSERT INTO "proposal" ("kind", "anime_id", "payload", "sources", "ai_model", "prompt_version", "status", "reviewed_by", "reviewed_at", "created_at")
SELECT
  'metadata',
  "anime_id",
  "fields",
  "sources",
  "ai_model",
  "prompt_version",
  CASE "status"::text
    WHEN 'draft' THEN 'pending'
    WHEN 'reviewed' THEN 'approved'
    WHEN 'published' THEN 'applied'
    ELSE 'rejected'
  END::"proposal_status",
  "reviewed_by",
  "reviewed_at",
  "created_at"
FROM "ai_draft";
