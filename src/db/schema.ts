import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Schema follows DESIGN.md section 9. Two deliberate differences:
// - the table is `users`, because `user` is a reserved word in PostgreSQL.
// - `anime` has no season/year columns. They live only in `season_entry`.

export const animeStatusEnum = pgEnum("anime_status", [
  "upcoming",
  "airing",
  "finished",
  "hiatus",
]);
export const seasonEnum = pgEnum("season", ["winter", "spring", "summer", "fall"]);
export const episodeStatusEnum = pgEnum("episode_status", [
  "scheduled",
  "aired",
  "delayed",
]);
export const textSourceEnum = pgEnum("text_source", ["official", "human", "machine"]);
export const langSourceEnum = pgEnum("lang_source", ["detected", "user"]);
export const commentStatusEnum = pgEnum("comment_status", [
  "visible",
  "hidden",
  "removed",
]);
export const availabilityEventEnum = pgEnum("availability_event", [
  "added",
  "changed",
  "removed",
]);
export const entryKindEnum = pgEnum("entry_kind", ["tv", "movie", "ova", "special"]);
export const proposalKindEnum = pgEnum("proposal_kind", [
  "metadata",
  "grouping",
  "season_label",
  "availability",
  "announcement",
]);
export const proposalStatusEnum = pgEnum("proposal_status", [
  "pending",
  "approved",
  "rejected",
  "applied",
]);
export const userRoleEnum = pgEnum("user_role", ["user", "moderator", "admin"]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  // Matches auth.users.id in Supabase Auth. The email stays in Supabase and is never copied here.
  id: uuid("id").primaryKey(),
  username: text("username").notNull().unique(),
  // Taken from the Google profile on each sign-in, so the public name stays current.
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  locale: text("locale").notNull().default("th"),
  timezone: text("timezone").notNull().default("Asia/Bangkok"),
  // Playback language preferences. Signed-in users keep them here, guests use a cookie.
  preferredAudio: text("preferred_audio"),
  preferredSub: text("preferred_sub"),
  role: userRoleEnum("role").notNull().default("user"),
  createdAt: createdAt(),
});

export const notificationKindEnum = pgEnum("notification_kind", [
  "episode_schedule",
  "availability",
]);
export const takedownStatusEnum = pgEnum("takedown_status", [
  "open",
  "actioned",
  "rejected",
]);

// A franchise such as "Jujutsu Kaisen". Its entries are seasons, movies and specials.
export const series = pgTable("series", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  titleRomaji: text("title_romaji").notNull(),
  anilistRootId: integer("anilist_root_id").unique(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const anime = pgTable(
  "anime",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    titleRomaji: text("title_romaji").notNull(),
    seriesId: uuid("series_id").references(() => series.id, { onDelete: "set null" }),
    entryKind: entryKindEnum("entry_kind").notNull().default("tv"),
    // "SS1", "SS2". Set only when the series has more than one TV season.
    seasonLabel: text("season_label"),
    sortOrder: integer("sort_order").notNull().default(0),
    // From AniList nextAiringEpisode. Episode rows only cover the sync window, so this is the
    // source for the EP badge.
    latestAiredEpisode: integer("latest_aired_episode"),
    malId: integer("mal_id").unique(),
    anilistId: integer("anilist_id").unique(),
    status: animeStatusEnum("status").notNull().default("upcoming"),
    format: text("format"),
    episodeCount: integer("episode_count"),
    genres: text("genres").array().notNull().default(sql`'{}'`),
    averageScore: integer("average_score"),
    startDate: date("start_date"),
    coverUrl: text("cover_url"),
    bannerUrl: text("banner_url"),
    anilistSyncedAt: timestamp("anilist_synced_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("anime_status_idx").on(t.status), index("anime_series_idx").on(t.seriesId)],
);

export const animeI18n = pgTable(
  "anime_i18n",
  {
    animeId: uuid("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    title: text("title").notNull(),
    synopsis: text("synopsis"),
    source: textSourceEnum("source").notNull(),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.animeId, t.locale] })],
);

export const seasonEntry = pgTable(
  "season_entry",
  {
    animeId: uuid("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    season: seasonEnum("season").notNull(),
    year: integer("year").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.animeId, t.season, t.year] }),
    index("season_entry_year_season_idx").on(t.year, t.season),
  ],
);

export const episode = pgTable(
  "episode",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    animeId: uuid("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    airAtUtc: timestamp("air_at_utc", { withTimezone: true }),
    airTzSource: text("air_tz_source"),
    status: episodeStatusEnum("status").notNull().default("scheduled"),
  },
  (t) => [
    uniqueIndex("episode_anime_number_uq").on(t.animeId, t.number),
    index("episode_air_at_idx").on(t.airAtUtc),
  ],
);

export const episodeScheduleLog = pgTable(
  "episode_schedule_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episode.id, { onDelete: "cascade" }),
    oldAirAtUtc: timestamp("old_air_at_utc", { withTimezone: true }),
    newAirAtUtc: timestamp("new_air_at_utc", { withTimezone: true }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("episode_schedule_log_episode_idx").on(t.episodeId)],
);

export const platform = pgTable("platform", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  regions: text("regions").array().notNull().default(sql`'{}'`),
  officialUrl: text("official_url").notNull(),
});

export const platformAvailability = pgTable(
  "platform_availability",
  {
    id: serial("id").primaryKey(),
    animeId: uuid("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    platformId: integer("platform_id")
      .notNull()
      .references(() => platform.id, { onDelete: "cascade" }),
    region: text("region").notNull(),
    audioLangs: text("audio_langs").array().notNull().default(sql`'{}'`),
    subLangs: text("sub_langs").array().notNull().default(sql`'{}'`),
    availableFrom: timestamp("available_from", { withTimezone: true }),
    availableTo: timestamp("available_to", { withTimezone: true }),
    // Which episodes the platform has. END needs full coverage (DESIGN.md section 7).
    coversAllEpisodes: boolean("covers_all_episodes").notNull().default(false),
    episodeFrom: integer("episode_from"),
    episodeTo: integer("episode_to"),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
    verifiedBy: uuid("verified_by").references(() => users.id),
  },
  (t) => [index("platform_availability_anime_idx").on(t.animeId)],
);

export const availabilityLog = pgTable(
  "availability_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    animeId: uuid("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    platformId: integer("platform_id")
      .notNull()
      .references(() => platform.id, { onDelete: "cascade" }),
    event: availabilityEventEnum("event").notNull(),
    audioLangs: text("audio_langs").array().notNull().default(sql`'{}'`),
    subLangs: text("sub_langs").array().notNull().default(sql`'{}'`),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    sourceUrl: text("source_url").notNull(),
  },
  (t) => [index("availability_log_anime_occurred_idx").on(t.animeId, t.occurredAt)],
);

export const trailer = pgTable("trailer", {
  id: serial("id").primaryKey(),
  animeId: uuid("anime_id")
    .notNull()
    .references(() => anime.id, { onDelete: "cascade" }),
  youtubeId: text("youtube_id").notNull().unique(),
  channelId: text("channel_id").notNull(),
  channelVerified: boolean("channel_verified").notNull().default(false),
});

// Threads belong to a title or to an episode. They are never deleted when
// availability ends (DESIGN.md section 5).
export const thread = pgTable(
  "thread",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    animeId: uuid("anime_id")
      .unique()
      .references(() => anime.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .unique()
      .references(() => episode.id, { onDelete: "cascade" }),
    locked: boolean("locked").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "thread_one_target",
      sql`(${t.animeId} is not null) <> (${t.episodeId} is not null)`,
    ),
  ],
);

export const comment = pgTable(
  "comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => thread.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    parentId: uuid("parent_id").references((): AnyPgColumn => comment.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    lang: text("lang").notNull(),
    langSource: langSourceEnum("lang_source").notNull().default("detected"),
    status: commentStatusEnum("status").notNull().default("visible"),
    createdAt: createdAt(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => [
    index("comment_thread_created_idx").on(t.threadId, t.createdAt),
    index("comment_parent_idx").on(t.parentId),
    check("comment_body_length", sql`char_length(${t.body}) between 1 and 2000`),
  ],
);

export const commentReport = pgTable(
  "comment_report",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comment.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("comment_report_once_uq").on(t.commentId, t.userId)],
);

// Everything the AI proposes goes through this queue. The AI never writes to the public
// tables directly (see src/ai/policy.ts). Each row keeps its sources and model version.
export const proposal = pgTable(
  "proposal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: proposalKindEnum("kind").notNull(),
    animeId: uuid("anime_id").references(() => anime.id, { onDelete: "cascade" }),
    seriesId: uuid("series_id").references(() => series.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull(),
    sources: jsonb("sources").notNull(),
    aiModel: text("ai_model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    status: proposalStatusEnum("status").notNull().default("pending"),
    autoApplied: boolean("auto_applied").notNull().default(false),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("proposal_status_kind_idx").on(t.status, t.kind),
    index("proposal_anime_idx").on(t.animeId),
  ],
);

// Channels whose trailers may be embedded. Only admins add rows here (DESIGN.md section 1).
export const officialChannel = pgTable("official_channel", {
  channelId: text("channel_id").primaryKey(),
  name: text("name").notNull(),
  evidenceUrl: text("evidence_url").notNull(),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
});

// Official news from studios, distributors and platforms. Always linked to the source.
export const announcement = pgTable(
  "announcement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    animeId: uuid("anime_id").references(() => anime.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    summary: text("summary"),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("announcement_published_idx").on(t.publishedAt)],
);

// Watch order for a franchise, listed on the title's watch-order page.
export const watchOrderEntry = pgTable(
  "watch_order_entry",
  {
    id: serial("id").primaryKey(),
    animeId: uuid("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    relatedAnimeId: uuid("related_anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    relation: text("relation").notNull(),
    isSpoiler: boolean("is_spoiler").notNull().default(false),
    note: text("note"),
  },
  (t) => [uniqueIndex("watch_order_position_uq").on(t.animeId, t.position)],
);

export const animeVote = pgTable(
  "anime_vote",
  {
    animeId: uuid("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.animeId, t.userId] }),
    index("anime_vote_anime_idx").on(t.animeId),
  ],
);

export const animeFollow = pgTable(
  "anime_follow",
  {
    animeId: uuid("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.animeId, t.userId] }),
    index("anime_follow_user_idx").on(t.userId),
  ],
);

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    animeId: uuid("anime_id").references(() => anime.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.readAt)],
);

// Notice-and-takedown requests (DESIGN.md section 13).
export const takedownRequest = pgTable("takedown_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email").notNull(),
  url: text("url").notNull(),
  reason: text("reason").notNull(),
  status: takedownStatusEnum("status").notNull().default("open"),
  createdAt: createdAt(),
});
