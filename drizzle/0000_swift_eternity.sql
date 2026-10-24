CREATE TYPE "public"."ai_draft_status" AS ENUM('draft', 'reviewed', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."anime_status" AS ENUM('upcoming', 'airing', 'finished', 'hiatus');--> statement-breakpoint
CREATE TYPE "public"."availability_event" AS ENUM('added', 'changed', 'removed');--> statement-breakpoint
CREATE TYPE "public"."comment_status" AS ENUM('visible', 'hidden', 'removed');--> statement-breakpoint
CREATE TYPE "public"."episode_status" AS ENUM('scheduled', 'aired', 'delayed');--> statement-breakpoint
CREATE TYPE "public"."lang_source" AS ENUM('detected', 'user');--> statement-breakpoint
CREATE TYPE "public"."season" AS ENUM('winter', 'spring', 'summer', 'fall');--> statement-breakpoint
CREATE TYPE "public"."text_source" AS ENUM('official', 'human', 'machine');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'moderator', 'admin');--> statement-breakpoint
CREATE TABLE "ai_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anime_id" uuid NOT NULL,
	"fields" jsonb NOT NULL,
	"sources" jsonb NOT NULL,
	"ai_model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"status" "ai_draft_status" DEFAULT 'draft' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anime" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title_romaji" text NOT NULL,
	"mal_id" integer,
	"anilist_id" integer,
	"status" "anime_status" DEFAULT 'upcoming' NOT NULL,
	"cover_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anime_slug_unique" UNIQUE("slug"),
	CONSTRAINT "anime_mal_id_unique" UNIQUE("mal_id"),
	CONSTRAINT "anime_anilist_id_unique" UNIQUE("anilist_id")
);
--> statement-breakpoint
CREATE TABLE "anime_i18n" (
	"anime_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"synopsis" text,
	"source" text_source NOT NULL,
	"reviewed_by" uuid,
	CONSTRAINT "anime_i18n_anime_id_locale_pk" PRIMARY KEY("anime_id","locale")
);
--> statement-breakpoint
CREATE TABLE "availability_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"anime_id" uuid NOT NULL,
	"platform_id" integer NOT NULL,
	"event" "availability_event" NOT NULL,
	"audio_langs" text[] DEFAULT '{}' NOT NULL,
	"sub_langs" text[] DEFAULT '{}' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"lang" text NOT NULL,
	"lang_source" "lang_source" DEFAULT 'detected' NOT NULL,
	"status" "comment_status" DEFAULT 'visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	CONSTRAINT "comment_body_length" CHECK (char_length("comment"."body") between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "comment_report" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anime_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"air_at_utc" timestamp with time zone,
	"air_tz_source" text,
	"status" "episode_status" DEFAULT 'scheduled' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode_schedule_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"episode_id" uuid NOT NULL,
	"old_air_at_utc" timestamp with time zone,
	"new_air_at_utc" timestamp with time zone,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"regions" text[] DEFAULT '{}' NOT NULL,
	"official_url" text NOT NULL,
	CONSTRAINT "platform_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "platform_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"anime_id" uuid NOT NULL,
	"platform_id" integer NOT NULL,
	"region" text NOT NULL,
	"audio_langs" text[] DEFAULT '{}' NOT NULL,
	"sub_langs" text[] DEFAULT '{}' NOT NULL,
	"available_from" timestamp with time zone,
	"available_to" timestamp with time zone,
	"source_url" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"verified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "season_entry" (
	"anime_id" uuid NOT NULL,
	"season" "season" NOT NULL,
	"year" integer NOT NULL,
	CONSTRAINT "season_entry_anime_id_season_year_pk" PRIMARY KEY("anime_id","season","year")
);
--> statement-breakpoint
CREATE TABLE "thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anime_id" uuid,
	"episode_id" uuid,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "thread_anime_id_unique" UNIQUE("anime_id"),
	CONSTRAINT "thread_episode_id_unique" UNIQUE("episode_id"),
	CONSTRAINT "thread_one_target" CHECK (("thread"."anime_id" is not null) <> ("thread"."episode_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "trailer" (
	"id" serial PRIMARY KEY NOT NULL,
	"anime_id" uuid NOT NULL,
	"youtube_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"channel_verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "trailer_youtube_id_unique" UNIQUE("youtube_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"locale" text DEFAULT 'th' NOT NULL,
	"timezone" text DEFAULT 'Asia/Bangkok' NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anime_i18n" ADD CONSTRAINT "anime_i18n_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anime_i18n" ADD CONSTRAINT "anime_i18n_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_log" ADD CONSTRAINT "availability_log_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_log" ADD CONSTRAINT "availability_log_platform_id_platform_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platform"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_thread_id_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_parent_id_comment_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_report" ADD CONSTRAINT "comment_report_comment_id_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_report" ADD CONSTRAINT "comment_report_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode" ADD CONSTRAINT "episode_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_schedule_log" ADD CONSTRAINT "episode_schedule_log_episode_id_episode_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episode"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_availability" ADD CONSTRAINT "platform_availability_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_availability" ADD CONSTRAINT "platform_availability_platform_id_platform_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platform"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_availability" ADD CONSTRAINT "platform_availability_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_entry" ADD CONSTRAINT "season_entry_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread" ADD CONSTRAINT "thread_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread" ADD CONSTRAINT "thread_episode_id_episode_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episode"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trailer" ADD CONSTRAINT "trailer_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_draft_status_idx" ON "ai_draft" USING btree ("status");--> statement-breakpoint
CREATE INDEX "availability_log_anime_occurred_idx" ON "availability_log" USING btree ("anime_id","occurred_at");--> statement-breakpoint
CREATE INDEX "comment_thread_created_idx" ON "comment" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_parent_idx" ON "comment" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comment_report_once_uq" ON "comment_report" USING btree ("comment_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "episode_anime_number_uq" ON "episode" USING btree ("anime_id","number");--> statement-breakpoint
CREATE INDEX "episode_air_at_idx" ON "episode" USING btree ("air_at_utc");--> statement-breakpoint
CREATE INDEX "episode_schedule_log_episode_idx" ON "episode_schedule_log" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX "platform_availability_anime_idx" ON "platform_availability" USING btree ("anime_id");--> statement-breakpoint
CREATE INDEX "season_entry_year_season_idx" ON "season_entry" USING btree ("year","season");