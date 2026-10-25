import { and, asc, desc, eq, gte, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db/client";
import {
  anime,
  animeI18n,
  animeVote,
  announcement,
  availabilityLog,
  episode,
  episodeScheduleLog,
  platform,
  platformAvailability,
  seasonEntry,
  thread,
  trailer,
  watchOrderEntry,
  comment,
} from "@/db/schema";
import type { Season } from "@/lib/slug";

// Public catalog reads. Each function is cached and tagged, so the sync job and admin
// actions can refresh it with revalidateTag("anime") or updateTag(`anime:${slug}`).
// Callers await connection() first, so nothing here runs during the build.

export async function getAnimeBySlug(slug: string) {
  "use cache";
  cacheTag("anime", `anime:${slug}`);
  cacheLife("hours");

  const db = getDb();
  const [row] = await db.select().from(anime).where(eq(anime.slug, slug)).limit(1);
  if (!row) return null;

  const [titles, seasons, episodes, trailers, threads] = await Promise.all([
    db.select().from(animeI18n).where(eq(animeI18n.animeId, row.id)),
    db.select().from(seasonEntry).where(eq(seasonEntry.animeId, row.id)),
    db
      .select({ number: episode.number, airAtUtc: episode.airAtUtc, status: episode.status, id: episode.id })
      .from(episode)
      .where(eq(episode.animeId, row.id))
      .orderBy(asc(episode.number)),
    db.select().from(trailer).where(and(eq(trailer.animeId, row.id), eq(trailer.channelVerified, true))),
    db.select({ id: thread.id }).from(thread).where(eq(thread.animeId, row.id)).limit(1),
  ]);

  return {
    anime: row,
    titles,
    seasons,
    episodes,
    trailers,
    threadId: threads[0]?.id ?? null,
  };
}

export async function getEpisodeDetail(animeSlug: string, number: number) {
  "use cache";
  cacheTag("anime", `anime:${animeSlug}`);
  cacheLife("hours");

  const db = getDb();
  const [row] = await db
    .select({ episode, anime })
    .from(episode)
    .innerJoin(anime, eq(episode.animeId, anime.id))
    .where(and(eq(anime.slug, animeSlug), eq(episode.number, number)))
    .limit(1);
  if (!row) return null;

  const [titles, threads, schedule] = await Promise.all([
    db.select().from(animeI18n).where(eq(animeI18n.animeId, row.anime.id)),
    db.select({ id: thread.id }).from(thread).where(eq(thread.episodeId, row.episode.id)).limit(1),
    db
      .select()
      .from(episodeScheduleLog)
      .where(eq(episodeScheduleLog.episodeId, row.episode.id))
      .orderBy(desc(episodeScheduleLog.changedAt))
      .limit(10),
  ]);

  return {
    anime: row.anime,
    episode: row.episode,
    titles,
    threadId: threads[0]?.id ?? null,
    schedule,
  };
}

export type AiringItem = {
  animeId: string;
  slug: string;
  number: number;
  airAtUtc: Date;
  status: string;
  titleRomaji: string;
  coverUrl: string | null;
  genres: string[];
  titles: { locale: string; title: string; source: string }[];
};

// Episodes airing in [from, to). Used by the home feed and the schedule page.
export async function getAiringBetween(from: Date, to: Date, limit = 60): Promise<AiringItem[]> {
  "use cache";
  cacheTag("anime", "schedule");
  cacheLife("minutes");

  const db = getDb();
  const rows = await db
    .select({
      animeId: anime.id,
      slug: anime.slug,
      number: episode.number,
      airAtUtc: episode.airAtUtc,
      status: episode.status,
      titleRomaji: anime.titleRomaji,
      coverUrl: anime.coverUrl,
      genres: anime.genres,
    })
    .from(episode)
    .innerJoin(anime, eq(episode.animeId, anime.id))
    .where(and(gte(episode.airAtUtc, from), lt(episode.airAtUtc, to)))
    .orderBy(asc(episode.airAtUtc))
    .limit(limit);

  const titles = await loadTitles(db, [...new Set(rows.map((row) => row.animeId))]);

  return rows.flatMap((row) =>
    row.airAtUtc
      ? [{ ...row, airAtUtc: row.airAtUtc, titles: titles.get(row.animeId) ?? [] }]
      : [],
  );
}

export async function getAnnouncements(limit = 6) {
  "use cache";
  cacheTag("anime", "announcements");
  cacheLife("minutes");

  const db = getDb();
  return db
    .select()
    .from(announcement)
    .orderBy(desc(announcement.publishedAt))
    .limit(limit);
}

export async function getAvailabilityChanges(limit = 8) {
  "use cache";
  cacheTag("anime", "availability");
  cacheLife("minutes");

  const db = getDb();
  return db
    .select({
      event: availabilityLog.event,
      occurredAt: availabilityLog.occurredAt,
      audioLangs: availabilityLog.audioLangs,
      subLangs: availabilityLog.subLangs,
      animeSlug: anime.slug,
      titleRomaji: anime.titleRomaji,
      platformName: platform.name,
    })
    .from(availabilityLog)
    .innerJoin(anime, eq(availabilityLog.animeId, anime.id))
    .innerJoin(platform, eq(availabilityLog.platformId, platform.id))
    .orderBy(desc(availabilityLog.occurredAt))
    .limit(limit);
}

// Threads with the most visible comments since `since`.
export async function getHotThreads(since: Date, limit = 6) {
  "use cache";
  cacheTag("anime", "threads");
  cacheLife("minutes");

  const db = getDb();
  const counts = await db
    .select({
      threadId: comment.threadId,
      total: sql<number>`count(*)::int`,
    })
    .from(comment)
    .where(and(eq(comment.status, "visible"), gte(comment.createdAt, since)))
    .groupBy(comment.threadId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  if (counts.length === 0) return [];

  const threadIds = counts.map((row) => row.threadId);
  const threads = await db
    .select({ id: thread.id, animeId: thread.animeId, episodeId: thread.episodeId })
    .from(thread)
    .where(inArray(thread.id, threadIds));

  const episodeIds = threads.flatMap((row) => (row.episodeId ? [row.episodeId] : []));
  const episodes = episodeIds.length
    ? await db
        .select({ id: episode.id, number: episode.number, animeId: episode.animeId })
        .from(episode)
        .where(inArray(episode.id, episodeIds))
    : [];

  const animeIds = [
    ...new Set([
      ...threads.flatMap((row) => (row.animeId ? [row.animeId] : [])),
      ...episodes.map((row) => row.animeId),
    ]),
  ];
  const animeRows = animeIds.length
    ? await db
        .select({ id: anime.id, slug: anime.slug, titleRomaji: anime.titleRomaji })
        .from(anime)
        .where(inArray(anime.id, animeIds))
    : [];
  const titles = await loadTitles(db, animeIds);

  return counts.flatMap((count) => {
    const target = threads.find((row) => row.id === count.threadId);
    if (!target) return [];

    const episodeRow = episodes.find((row) => row.id === target.episodeId);
    const animeId = target.animeId ?? episodeRow?.animeId;
    const animeRow = animeRows.find((row) => row.id === animeId);
    if (!animeRow) return [];

    return [
      {
        threadId: target.id,
        total: count.total,
        slug: animeRow.slug,
        romaji: animeRow.titleRomaji,
        episodeNumber: episodeRow?.number ?? null,
        titles: titles.get(animeRow.id) ?? [],
      },
    ];
  });
}

export async function getSeasonAnime(year: number, season: Season) {
  "use cache";
  cacheTag("anime", `season:${year}-${season}`);
  cacheLife("hours");

  const db = getDb();
  const rows = await db
    .select({
      id: anime.id,
      slug: anime.slug,
      titleRomaji: anime.titleRomaji,
      coverUrl: anime.coverUrl,
      genres: anime.genres,
      status: anime.status,
      averageScore: anime.averageScore,
      votes: sql<number>`count(${animeVote.userId})::int`,
    })
    .from(seasonEntry)
    .innerJoin(anime, eq(seasonEntry.animeId, anime.id))
    .leftJoin(animeVote, eq(animeVote.animeId, anime.id))
    .where(and(eq(seasonEntry.year, year), eq(seasonEntry.season, season)))
    .groupBy(anime.id)
    .orderBy(desc(sql`count(${animeVote.userId})`), desc(anime.averageScore));

  const titles = await loadTitles(db, rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, titles: titles.get(row.id) ?? [] }));
}

export type SearchFilters = {
  query?: string;
  genre?: string;
  thaiDub?: boolean;
  thaiSub?: boolean;
  platformId?: number;
};

export async function searchAnime(filters: SearchFilters, limit = 48) {
  "use cache";
  cacheTag("anime", "search");
  cacheLife("minutes");

  const db = getDb();
  const conditions: SQL[] = [];

  if (filters.query?.trim()) {
    const pattern = `%${filters.query.trim()}%`;
    conditions.push(
      sql`(${anime.titleRomaji} ilike ${pattern} or exists (
        select 1 from ${animeI18n} ai where ai.anime_id = ${anime.id} and ai.title ilike ${pattern}
      ))`,
    );
  }
  if (filters.genre) {
    conditions.push(sql`${filters.genre} = any(${anime.genres})`);
  }
  if (filters.thaiDub) {
    conditions.push(sql`exists (
      select 1 from ${platformAvailability} pa
      where pa.anime_id = ${anime.id} and 'th' = any(pa.audio_langs) and pa.available_to is null
    )`);
  }
  if (filters.thaiSub) {
    conditions.push(sql`exists (
      select 1 from ${platformAvailability} pa
      where pa.anime_id = ${anime.id} and 'th' = any(pa.sub_langs) and pa.available_to is null
    )`);
  }
  if (filters.platformId) {
    conditions.push(sql`exists (
      select 1 from ${platformAvailability} pa
      where pa.anime_id = ${anime.id} and pa.platform_id = ${filters.platformId} and pa.available_to is null
    )`);
  }

  const rows = await db
    .select({
      id: anime.id,
      slug: anime.slug,
      titleRomaji: anime.titleRomaji,
      coverUrl: anime.coverUrl,
      genres: anime.genres,
      status: anime.status,
      averageScore: anime.averageScore,
    })
    .from(anime)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(anime.averageScore), asc(anime.titleRomaji))
    .limit(limit);

  const titles = await loadTitles(db, rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, titles: titles.get(row.id) ?? [] }));
}

export async function getGenres() {
  "use cache";
  cacheTag("anime", "genres");
  cacheLife("days");

  const db = getDb();
  const rows = await db.execute<{ genre: string }>(
    sql`select distinct unnest(genres) as genre from ${anime} order by genre`,
  );
  return rows.map((row) => row.genre);
}

export async function getPlatforms() {
  "use cache";
  cacheTag("platforms");
  cacheLife("days");

  return getDb().select().from(platform).orderBy(asc(platform.name));
}

export async function getWhereToWatch(platformId: number) {
  "use cache";
  cacheTag("anime", `platform:${platformId}`);
  cacheLife("minutes");

  const db = getDb();
  const rows = await db
    .select({
      id: anime.id,
      slug: anime.slug,
      titleRomaji: anime.titleRomaji,
      coverUrl: anime.coverUrl,
      audioLangs: platformAvailability.audioLangs,
      subLangs: platformAvailability.subLangs,
      verifiedAt: platformAvailability.verifiedAt,
      region: platformAvailability.region,
    })
    .from(platformAvailability)
    .innerJoin(anime, eq(platformAvailability.animeId, anime.id))
    .where(and(eq(platformAvailability.platformId, platformId), isNull(platformAvailability.availableTo)))
    .orderBy(asc(anime.titleRomaji));

  const titles = await loadTitles(db, rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, titles: titles.get(row.id) ?? [] }));
}

export async function getAvailabilityForAnime(animeId: string) {
  "use cache";
  cacheTag("anime", `availability:${animeId}`);
  cacheLife("minutes");

  const db = getDb();
  const [current, history] = await Promise.all([
    db
      .select({
        id: platformAvailability.id,
        platformName: platform.name,
        platformUrl: platform.officialUrl,
        region: platformAvailability.region,
        audioLangs: platformAvailability.audioLangs,
        subLangs: platformAvailability.subLangs,
        verifiedAt: platformAvailability.verifiedAt,
        sourceUrl: platformAvailability.sourceUrl,
      })
      .from(platformAvailability)
      .innerJoin(platform, eq(platformAvailability.platformId, platform.id))
      .where(and(eq(platformAvailability.animeId, animeId), isNull(platformAvailability.availableTo))),
    db
      .select({
        event: availabilityLog.event,
        occurredAt: availabilityLog.occurredAt,
        audioLangs: availabilityLog.audioLangs,
        subLangs: availabilityLog.subLangs,
        platformName: platform.name,
      })
      .from(availabilityLog)
      .innerJoin(platform, eq(availabilityLog.platformId, platform.id))
      .where(eq(availabilityLog.animeId, animeId))
      .orderBy(desc(availabilityLog.occurredAt))
      .limit(20),
  ]);

  return { current, history };
}

export async function getWatchOrder(animeId: string) {
  "use cache";
  cacheTag("anime", `watch-order:${animeId}`);
  cacheLife("hours");

  const db = getDb();
  const rows = await db
    .select({
      position: watchOrderEntry.position,
      relation: watchOrderEntry.relation,
      isSpoiler: watchOrderEntry.isSpoiler,
      note: watchOrderEntry.note,
      relatedId: anime.id,
      relatedSlug: anime.slug,
      relatedTitle: anime.titleRomaji,
    })
    .from(watchOrderEntry)
    .innerJoin(anime, eq(watchOrderEntry.relatedAnimeId, anime.id))
    .where(eq(watchOrderEntry.animeId, animeId))
    .orderBy(asc(watchOrderEntry.position));

  const titles = await loadTitles(db, rows.map((row) => row.relatedId));
  return rows.map((row) => ({ ...row, titles: titles.get(row.relatedId) ?? [] }));
}

// Loads titles for many anime at once, keyed by anime id. Used by the list queries above.
async function loadTitles(db: ReturnType<typeof getDb>, animeIds: string[]) {
  const map = new Map<string, { locale: string; title: string; source: string }[]>();
  if (animeIds.length === 0) return map;

  const rows = await db
    .select({
      animeId: animeI18n.animeId,
      locale: animeI18n.locale,
      title: animeI18n.title,
      source: animeI18n.source,
    })
    .from(animeI18n)
    .where(inArray(animeI18n.animeId, animeIds));

  for (const row of rows) {
    const list = map.get(row.animeId) ?? [];
    list.push({ locale: row.locale, title: row.title, source: row.source });
    map.set(row.animeId, list);
  }
  return map;
}
