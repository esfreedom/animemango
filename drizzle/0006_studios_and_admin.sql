CREATE TYPE "public"."anime_studio_role" AS ENUM('produce', 'distribute', 'licensor');--> statement-breakpoint
CREATE TYPE "public"."studio_channel_platform" AS ENUM('youtube', 'facebook', 'x', 'website');--> statement-breakpoint
CREATE TYPE "public"."studio_channel_status" AS ENUM('pending', 'approved', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."studio_kind" AS ENUM('studio', 'distributor', 'platform', 'rights_holder');--> statement-breakpoint
CREATE TABLE "admin_credential" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_credential_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "admin_login_attempt" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anime_studio" (
	"anime_id" uuid NOT NULL,
	"studio_id" uuid NOT NULL,
	"role" "anime_studio_role" NOT NULL,
	CONSTRAINT "anime_studio_anime_id_studio_id_role_pk" PRIMARY KEY("anime_id","studio_id","role")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_audit" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"status_code" integer,
	"issues" jsonb NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_romaji" text NOT NULL,
	"name_th" text,
	"name_th_source_url" text,
	"kind" "studio_kind" DEFAULT 'studio' NOT NULL,
	"website_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "studio_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "studio_channel" (
	"id" serial PRIMARY KEY NOT NULL,
	"studio_id" uuid NOT NULL,
	"platform" "studio_channel_platform" NOT NULL,
	"channel_id" text NOT NULL,
	"url" text NOT NULL,
	"status" "studio_channel_status" DEFAULT 'pending' NOT NULL,
	"allow_trailer" boolean DEFAULT false NOT NULL,
	"evidence_url" text NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "last_updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "trailer" ADD COLUMN "studio_channel_id" integer;--> statement-breakpoint
ALTER TABLE "anime_studio" ADD CONSTRAINT "anime_studio_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anime_studio" ADD CONSTRAINT "anime_studio_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_channel" ADD CONSTRAINT "studio_channel_studio_id_studio_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."studio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_channel" ADD CONSTRAINT "studio_channel_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_login_attempt_ip_idx" ON "admin_login_attempt" USING btree ("ip_hash","attempted_at");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target");--> statement-breakpoint
CREATE INDEX "seo_audit_url_idx" ON "seo_audit" USING btree ("url","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "studio_channel_platform_id_uq" ON "studio_channel" USING btree ("platform","channel_id");--> statement-breakpoint
ALTER TABLE "trailer" ADD CONSTRAINT "trailer_studio_channel_id_studio_channel_id_fk" FOREIGN KEY ("studio_channel_id") REFERENCES "public"."studio_channel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "studio" ("slug", "name_romaji", "kind")
SELECT 'yt-' || substr(md5("channel_id"), 1, 12), "name", 'studio' FROM "official_channel"
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "studio_channel" ("studio_id", "platform", "channel_id", "url", "status", "allow_trailer", "evidence_url", "approved_by", "approved_at")
SELECT s."id", 'youtube', oc."channel_id", 'https://www.youtube.com/channel/' || oc."channel_id", 'approved', true, oc."evidence_url", oc."verified_by", oc."verified_at"
FROM "official_channel" oc
JOIN "studio" s ON s."slug" = 'yt-' || substr(md5(oc."channel_id"), 1, 12)
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "trailer" t SET "studio_channel_id" = sc."id"
FROM "studio_channel" sc
WHERE sc."platform" = 'youtube' AND sc."channel_id" = t."channel_id" AND t."channel_verified" = true;--> statement-breakpoint
UPDATE "series" SET "last_updated_at" = "updated_at";
