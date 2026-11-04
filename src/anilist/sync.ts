import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  anime,
  animeFollow,
  animeI18n,
  episode,
  episodeScheduleLog,
  notification,
  seasonEntry,
  series,
  thread,
} from "@/db/schema";
import { resolveSeriesGraph, seriesTitleFrom, type GraphMedia } from "@/lib/series-graph";
import { slugify } from "@/lib/slug";
import { formatAirTime } from "@/lib/time";
import {
  fetchAiringWindow,
  fetchMediaWithRelations,
  isoDate,
  type FetchLike,
  type MediaWithRelations,
} from "./client";
import { groupByMedia, mapMedia, type MappedAnime } from "./mapper";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type SyncResult = {
  titles: number;
  episodes: number;
  scheduleChanges: number;
  notifications: number;
};

type SyncOptions = {
  db: Db;
  from: Date;
  to: Date;
  now?: Date;
  fetchImpl?: FetchLike;
  // Series resolution makes many AniList requests. Each run resolves only this many new
  // franchises, and the next scheduled run continues with the rest.
  maxSeriesPerRun?: number;
};

export const DEFAULT_SERIES_PER_RUN = 10;

// Pulls the airing window from AniList and writes titles, episodes and schedule
// changes. Each title is written in its own transaction, so one failure does not
// roll back the others.
export async function syncAiringWindow({
  db,
  from,
  to,
  now = new Date(),
  fetchImpl,
  maxSeriesPerRun = DEFAULT_SERIES_PER_RUN,
}: SyncOptions): Promise<SyncResult> {
  const entries = await fetchAiringWindow(
    { from: toUnixSeconds(from), to: toUnixSeconds(to) },
    fetchImpl,
  );

  const result: SyncResult = { titles: 0, episodes: 0, scheduleChanges: 0, notifications: 0 };
  let seriesAttached = 0;

  for (const group of groupByMedia(entries)) {
    const counts = await db.transaction((tx) => syncTitle(tx, group.anime, group.episodes, now));
    if (seriesAttached < maxSeriesPerRun && (await attachSeries(db, group.anime.anilistId, now, fetchImpl))) {
      seriesAttached++;
    }

    result.titles++;
    result.episodes += counts.episodes;
    result.scheduleChanges += counts.scheduleChanges;
    result.notifications += counts.notifications;
  }

  return result;
}

// Adds one title by its AniList id, along with its franchise. Used by the back office and the
// seed script. A new title stays unpublished until an admin publishes it. Returns null when AniList
// has no usable entry for the id (unknown, or adult content that is skipped).
export async function importAnimeByAniListId({
  db,
  anilistId,
  now = new Date(),
  fetchImpl,
}: {
  db: Db;
  anilistId: number;
  now?: Date;
  fetchImpl?: FetchLike;
}): Promise<{ animeId: string } | null> {
  const media = await fetchMediaWithRelations(anilistId, fetchImpl);
  const mapped = media ? mapMedia(media) : null;
  if (!mapped) return null;

  const counts = await db.transaction((tx) => syncTitle(tx, mapped, [], now));
  await attachSeries(db, anilistId, now, fetchImpl);
  return { animeId: counts.animeId };
}

async function syncTitle(
  tx: Tx,
  mapped: MappedAnime,
  episodes: { number: number; airingAt: Date }[],
  now: Date,
) {
  const slug = await resolveSlug(tx, mapped);
  const [row] = await tx
    .insert(anime)
    .values({
      slug,
      titleRomaji: mapped.titleRomaji,
      malId: mapped.malId,
      anilistId: mapped.anilistId,
      status: mapped.status,
      format: mapped.format,
      episodeCount: mapped.episodeCount,
      genres: mapped.genres,
      averageScore: mapped.averageScore,
      startDate: mapped.startDate,
      coverUrl: mapped.coverUrl,
      bannerUrl: mapped.bannerUrl,
      latestAiredEpisode: mapped.latestAiredEpisode,
      anilistSyncedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: anime.anilistId,
      set: {
        ...(mapped.latestAiredEpisode !== null ? { latestAiredEpisode: mapped.latestAiredEpisode } : {}),
        titleRomaji: mapped.titleRomaji,
        malId: mapped.malId,
        status: mapped.status,
        format: mapped.format,
        episodeCount: mapped.episodeCount,
        genres: mapped.genres,
        averageScore: mapped.averageScore,
        startDate: mapped.startDate,
        coverUrl: mapped.coverUrl,
        bannerUrl: mapped.bannerUrl,
        anilistSyncedAt: now,
        updatedAt: now,
      },
    })
    .returning({ id: anime.id, slug: anime.slug });

  // Official titles only fill empty slots. Human edits are never overwritten.
  const titles = [
    { locale: "en", title: mapped.titleEnglish ?? mapped.titleRomaji },
    ...(mapped.titleNative ? [{ locale: "ja", title: mapped.titleNative }] : []),
  ];
  // The AniList page is the URL for these names, so the official-source rule still holds.
  const anilistUrl = `https://anilist.co/anime/${mapped.anilistId}`;
  for (const item of titles) {
    await tx
      .insert(animeI18n)
      .values({ animeId: row.id, locale: item.locale, title: item.title, source: "official", sourceUrl: anilistUrl })
      .onConflictDoNothing();
  }

  if (mapped.season && mapped.seasonYear) {
    await tx
      .insert(seasonEntry)
      .values({ animeId: row.id, season: mapped.season, year: mapped.seasonYear })
      .onConflictDoNothing();
  }

  await tx.insert(thread).values({ animeId: row.id }).onConflictDoNothing();

  let scheduleChanges = 0;
  let notifications = 0;

  for (const item of episodes) {
    const outcome = await syncEpisode(tx, row, mapped, item, now);
    if (outcome.scheduleChanged) scheduleChanges++;
    notifications += outcome.notified;
  }

  return { animeId: row.id, episodes: episodes.length, scheduleChanges, notifications };
}

async function syncEpisode(
  tx: Tx,
  row: { id: string; slug: string },
  mapped: MappedAnime,
  item: { number: number; airingAt: Date },
  now: Date,
) {
  const status = item.airingAt.getTime() <= now.getTime() ? "aired" : "scheduled";
  const [current] = await tx
    .select()
    .from(episode)
    .where(and(eq(episode.animeId, row.id), eq(episode.number, item.number)))
    .limit(1);

  if (!current) {
    const [created] = await tx
      .insert(episode)
      .values({
        animeId: row.id,
        number: item.number,
        airAtUtc: item.airingAt,
        airTzSource: "AniList",
        status,
      })
      .returning({ id: episode.id });

    await tx.insert(thread).values({ episodeId: created.id }).onConflictDoNothing();
    return { scheduleChanged: false, notified: 0 };
  }

  const timeChanged = current.airAtUtc?.getTime() !== item.airingAt.getTime();
  if (!timeChanged && current.status === status) {
    return { scheduleChanged: false, notified: 0 };
  }

  await tx
    .update(episode)
    .set({ airAtUtc: item.airingAt, airTzSource: "AniList", status })
    .where(eq(episode.id, current.id));

  // A first-time schedule is not a change. Only moves of an existing time are logged and sent.
  if (!timeChanged || current.airAtUtc === null) {
    return { scheduleChanged: false, notified: 0 };
  }

  await tx.insert(episodeScheduleLog).values({
    episodeId: current.id,
    oldAirAtUtc: current.airAtUtc,
    newAirAtUtc: item.airingAt,
    changedAt: now,
  });

  const followers = await tx
    .select({ userId: animeFollow.userId })
    .from(animeFollow)
    .where(eq(animeFollow.animeId, row.id));

  if (followers.length > 0) {
    const title = mapped.titleEnglish ?? mapped.titleRomaji;
    await tx.insert(notification).values(
      followers.map((follower) => ({
        userId: follower.userId,
        kind: "episode_schedule" as const,
        animeId: row.id,
        title: `ตารางฉายเปลี่ยน: ${title}`,
        body: `ตอนที่ ${item.number} ย้ายเป็น ${formatAirTime(item.airingAt, "th", "Asia/Bangkok")} (เวลาไทย)`,
        href: `/th/anime/${row.slug}/ep/${item.number}`,
      })),
    );
  }

  return { scheduleChanged: true, notified: followers.length };
}

// Keeps a title's slug stable across syncs. A new title gets its romaji slug, or a
// suffix with the AniList id when another title already uses that slug.
async function resolveSlug(tx: Tx, mapped: MappedAnime): Promise<string> {
  const [existing] = await tx
    .select({ slug: anime.slug })
    .from(anime)
    .where(eq(anime.anilistId, mapped.anilistId))
    .limit(1);
  if (existing) return existing.slug;

  const base = slugify(mapped.titleRomaji);
  const [clash] = await tx.select({ id: anime.id }).from(anime).where(eq(anime.slug, base)).limit(1);
  return clash ? `${base}-${mapped.anilistId}` : base;
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

// Groups a title with its franchise (approved plan, section 2). Runs once per new title.
// The network calls happen before the transaction, so the write stays short.
// Returns true when a series was written.
async function attachSeries(db: Db, rootAnilistId: number, now: Date, fetchImpl?: FetchLike): Promise<boolean> {
  const [row] = await db
    .select({ seriesId: anime.seriesId })
    .from(anime)
    .where(eq(anime.anilistId, rootAnilistId))
    .limit(1);
  if (!row || row.seriesId) return false;

  const loaded = new Map<number, Promise<MediaWithRelations | null>>();
  const load = (id: number) => {
    if (!loaded.has(id)) loaded.set(id, fetchMediaWithRelations(id, fetchImpl));
    return loaded.get(id)!;
  };
  const fetchGraphMedia = async (id: number): Promise<GraphMedia | null> => {
    const media = await load(id);
    return media ? toGraphMedia(media) : null;
  };

  const entries = await resolveSeriesGraph(rootAnilistId, fetchGraphMedia);
  if (entries.length === 0) return false;

  const mediaById = new Map<number, MediaWithRelations>();
  for (const entry of entries) {
    const media = await load(entry.id);
    if (media) mediaById.set(entry.id, media);
  }

  const firstTv = entries.find((entry) => entry.kind === "tv");
  const firstTvMedia = firstTv ? mediaById.get(firstTv.id) : undefined;
  if (!firstTv || !firstTvMedia) return false;

  await db.transaction(async (tx) => {
    const seriesRow = await upsertSeries(tx, firstTv.id, seriesTitleFrom(firstTvMedia.title.romaji ?? firstTvMedia.title.english ?? `anime-${firstTv.id}`), now);

    for (const entry of entries) {
      const media = mediaById.get(entry.id);
      const mapped = media ? mapMedia(media) : null;
      if (!mapped) continue;

      const counts = await syncTitle(tx, mapped, [], now);
      await tx
        .update(anime)
        .set({
          seriesId: seriesRow.id,
          entryKind: entry.kind,
          seasonLabel: entry.seasonLabel,
          sortOrder: entry.sortOrder,
        })
        .where(eq(anime.id, counts.animeId));
    }
  });
  return true;
}

async function upsertSeries(tx: Tx, rootAnilistId: number, title: string, now: Date) {
  const [existing] = await tx
    .select({ id: series.id })
    .from(series)
    .where(eq(series.anilistRootId, rootAnilistId))
    .limit(1);
  const base = slugify(title);
  const [clash] = await tx.select({ id: series.id }).from(series).where(eq(series.slug, base)).limit(1);
  const slug = clash && !existing ? `${base}-${rootAnilistId}` : base;

  const [row] = await tx
    .insert(series)
    .values({ slug, titleRomaji: title, anilistRootId: rootAnilistId, updatedAt: now })
    .onConflictDoUpdate({
      target: series.anilistRootId,
      set: { titleRomaji: title, updatedAt: now },
    })
    .returning({ id: series.id });
  return row;
}

function toGraphMedia(media: MediaWithRelations): GraphMedia {
  const toNode = (node: { id: number; type: string | null; format: string | null; startDate: { year: number | null; month: number | null; day: number | null } | null; title: { romaji: string | null; english: string | null; native: string | null } }) => ({
    id: node.id,
    type: node.type,
    format: node.format,
    startDate: isoDate(node.startDate),
    title: node.title.romaji ?? node.title.english ?? node.title.native ?? `anime-${node.id}`,
  });

  return {
    ...toNode(media),
    edges: media.relations.edges.map((edge) => ({ relationType: edge.relationType, node: toNode(edge.node) })),
  };
}
