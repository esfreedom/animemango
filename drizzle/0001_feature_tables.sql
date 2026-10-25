CREATE TYPE "public"."notification_kind" AS ENUM('episode_schedule', 'availability');--> statement-breakpoint
CREATE TYPE "public"."takedown_status" AS ENUM('open', 'actioned', 'rejected');--> statement-breakpoint
CREATE TABLE "anime_follow" (
	"anime_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anime_follow_anime_id_user_id_pk" PRIMARY KEY("anime_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "anime_vote" (
	"anime_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anime_vote_anime_id_user_id_pk" PRIMARY KEY("anime_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "announcement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anime_id" uuid,
	"title" text NOT NULL,
	"summary" text,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"anime_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_channel" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"evidence_url" text NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "takedown_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_name" text NOT NULL,
	"requester_email" text NOT NULL,
	"url" text NOT NULL,
	"reason" text NOT NULL,
	"status" "takedown_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_order_entry" (
	"id" serial PRIMARY KEY NOT NULL,
	"anime_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"related_anime_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"is_spoiler" boolean DEFAULT false NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "format" text;--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "episode_count" integer;--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "genres" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "average_score" integer;--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "anime" ADD COLUMN "anilist_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "anime_follow" ADD CONSTRAINT "anime_follow_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anime_follow" ADD CONSTRAINT "anime_follow_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anime_vote" ADD CONSTRAINT "anime_vote_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anime_vote" ADD CONSTRAINT "anime_vote_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_channel" ADD CONSTRAINT "official_channel_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_order_entry" ADD CONSTRAINT "watch_order_entry_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_order_entry" ADD CONSTRAINT "watch_order_entry_related_anime_id_anime_id_fk" FOREIGN KEY ("related_anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anime_follow_user_idx" ON "anime_follow" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "anime_vote_anime_idx" ON "anime_vote" USING btree ("anime_id");--> statement-breakpoint
CREATE INDEX "announcement_published_idx" ON "announcement" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "watch_order_position_uq" ON "watch_order_entry" USING btree ("anime_id","position");--> statement-breakpoint
CREATE INDEX "anime_status_idx" ON "anime" USING btree ("status");