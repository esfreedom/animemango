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
  thread,
} from "@/db/schema";
import { slugify } from "@/lib/slug";
import { formatAirTime } from "@/lib/time";
import { fetchAiringWindow, type FetchLike } from "./client";
import { groupByMedia, type MappedAnime } from "./mapper";

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
};

// Pulls the airing window from AniList and writes titles, episodes and schedule
// changes. Each title is written in its own transaction, so one failure does not
// roll back the others.
export async function syncAiringWindow({
  db,
  from,
  to,
  now = new Date(),
  fetchImpl,
}: SyncOptions): Promise<SyncResult> {
  const entries = await fetchAiringWindow(
    { from: toUnixSeconds(from), to: toUnixSeconds(to) },
    fetchImpl,
  );

  const result: SyncResult = { titles: 0, episodes: 0, scheduleChanges: 0, notifications: 0 };

  for (const group of groupByMedia(entries)) {
    const counts = await db.transaction((tx) => syncTitle(tx, group.anime, group.episodes, now));

    result.titles++;
    result.episodes += counts.episodes;
    result.scheduleChanges += counts.scheduleChanges;
    result.notifications += counts.notifications;
  }

  return result;
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
      anilistSyncedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: anime.anilistId,
      set: {
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
  for (const item of titles) {
    await tx
      .insert(animeI18n)
      .values({ animeId: row.id, locale: item.locale, title: item.title, source: "official" })
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

  return { episodes: episodes.length, scheduleChanges, notifications };
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
