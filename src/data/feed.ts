import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { anime, animeI18n, episode, platform, platformAvailability, series } from "@/db/schema";
import { computeCornerBadge, resolveLatestAired, type BadgeAvailability, type BadgeEpisode, type CornerBadge } from "@/lib/badge";
import type { TitleRow } from "@/lib/titles";

// Home feed and series pages. These are not cached, because the answer depends on the current
// time. The titles and platform rows are small, so the cost is low.

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type PlatformChip = BadgeAvailability & {
  platformName: string;
  platformUrl: string;
  audioLangs: string[];
  subLangs: string[];
  verifiedAt: Date;
};

export type FeedEntry = {
  animeId: string;
  slug: string;
  titleRomaji: string;
  titles: TitleRow[];
  coverUrl: string | null;
  status: "upcoming" | "airing" | "finished" | "hiatus";
  entryKind: "tv" | "movie" | "ova" | "special";
  seasonLabel: string | null;
  seriesSlug: string | null;
  seriesTitle: string | null;
  episodeCount: number | null;
  latestAiredStored: number | null;
  episodes: BadgeEpisode[];
  platforms: PlatformChip[];
  lastAiredAt: Date | null;
  nextAirAt: Date | null;
  nextEpisode: number | null;
};

export async function getHomeFeed(now: Date): Promise<{ updated: FeedEntry[]; upcoming: FeedEntry[] }> {
  const db = getDb();
  const windowFrom = new Date(now.getTime() - WINDOW_MS);
  const windowTo = new Date(now.getTime() + WINDOW_MS);

  const rows = await db
    .select({
      animeId: anime.id,
      number: episode.number,
      airAtUtc: episode.airAtUtc,
    })
    .from(episode)
    .innerJoin(anime, eq(episode.animeId, anime.id))
    .where(and(gte(episode.airAtUtc, windowFrom), lt(episode.airAtUtc, windowTo)))
    .orderBy(asc(episode.airAtUtc))
    .limit(1000);

  const byAnime = new Map<string, { number: number; airAtUtc: Date }[]>();
  for (const row of rows) {
    if (!row.airAtUtc) continue;
    byAnime.set(row.animeId, [...(byAnime.get(row.animeId) ?? []), { number: row.number, airAtUtc: row.airAtUtc }]);
  }

  const updatedIds: { id: string; lastAiredAt: Date }[] = [];
  const upcomingIds: { id: string; nextAirAt: Date; nextEpisode: number }[] = [];
  for (const [id, list] of byAnime) {
    const aired = list.filter((item) => item.airAtUtc.getTime() <= now.getTime());
    const next = list.filter((item) => item.airAtUtc.getTime() > now.getTime());
    if (aired.length > 0) {
      const last = aired[aired.length - 1];
      updatedIds.push({ id, lastAiredAt: last.airAtUtc });
    }
    if (next.length > 0) {
      upcomingIds.push({ id, nextAirAt: next[0].airAtUtc, nextEpisode: next[0].number });
    }
  }

  updatedIds.sort((a, b) => b.lastAiredAt.getTime() - a.lastAiredAt.getTime());
  const updatedLimited = updatedIds.slice(0, 12);
  const updatedSet = new Set(updatedLimited.map((item) => item.id));
  const upcomingLimited = upcomingIds
    .filter((item) => !updatedSet.has(item.id))
    .sort((a, b) => a.nextAirAt.getTime() - b.nextAirAt.getTime())
    .slice(0, 12);

  const ids = [...updatedLimited.map((item) => item.id), ...upcomingLimited.map((item) => item.id)];
  const entries = await loadEntries(ids, now, byAnime);

  return {
    updated: updatedLimited.flatMap((item) => {
      const entry = entries.get(item.id);
      return entry ? [{ ...entry, lastAiredAt: item.lastAiredAt }] : [];
    }),
    upcoming: upcomingLimited.flatMap((item) => {
      const entry = entries.get(item.id);
      return entry ? [{ ...entry, nextAirAt: item.nextAirAt, nextEpisode: item.nextEpisode }] : [];
    }),
  };
}

// Full data for one series: every entry in order, with titles and platform rows.
export async function getSeriesEntries(seriesSlug: string, now: Date) {
  const db = getDb();
  const [parent] = await db.select().from(series).where(eq(series.slug, seriesSlug)).limit(1);
  if (!parent) return null;

  const members = await db
    .select({ id: anime.id })
    .from(anime)
    .where(eq(anime.seriesId, parent.id))
    .orderBy(asc(anime.sortOrder));

  const episodes = await db
    .select({ animeId: episode.animeId, number: episode.number, airAtUtc: episode.airAtUtc })
    .from(episode)
    .where(inArray(episode.animeId, members.map((member) => member.id)));

  const byAnime = new Map<string, { number: number; airAtUtc: Date }[]>();
  for (const row of episodes) {
    if (!row.airAtUtc) continue;
    byAnime.set(row.animeId, [...(byAnime.get(row.animeId) ?? []), { number: row.number, airAtUtc: row.airAtUtc }]);
  }

  const loaded = await loadEntries(members.map((member) => member.id), now, byAnime);
  return {
    series: parent,
    entries: members.flatMap((member) => {
      const entry = loaded.get(member.id);
      return entry ? [entry] : [];
    }),
  };
}

// Loads anime, series, titles and active platform rows for the given ids in one pass.
async function loadEntries(
  ids: string[],
  now: Date,
  episodesByAnime: Map<string, { number: number; airAtUtc: Date }[]>,
): Promise<Map<string, FeedEntry>> {
  const result = new Map<string, FeedEntry>();
  if (ids.length === 0) return result;

  const db = getDb();
  const [animeRows, titleRows, platformRows] = await Promise.all([
    db
      .select({
        id: anime.id,
        slug: anime.slug,
        titleRomaji: anime.titleRomaji,
        coverUrl: anime.coverUrl,
        status: anime.status,
        entryKind: anime.entryKind,
        seasonLabel: anime.seasonLabel,
        episodeCount: anime.episodeCount,
        latestAiredEpisode: anime.latestAiredEpisode,
        seriesSlug: series.slug,
        seriesTitle: series.titleRomaji,
      })
      .from(anime)
      .leftJoin(series, eq(anime.seriesId, series.id))
      .where(inArray(anime.id, ids)),
    db
      .select({ animeId: animeI18n.animeId, locale: animeI18n.locale, title: animeI18n.title, source: animeI18n.source, synopsis: animeI18n.synopsis })
      .from(animeI18n)
      .where(inArray(animeI18n.animeId, ids)),
    db
      .select({
        animeId: platformAvailability.animeId,
        platformName: platform.name,
        platformUrl: platform.officialUrl,
        audioLangs: platformAvailability.audioLangs,
        subLangs: platformAvailability.subLangs,
        availableTo: platformAvailability.availableTo,
        verifiedAt: platformAvailability.verifiedAt,
        coversAllEpisodes: platformAvailability.coversAllEpisodes,
        episodeFrom: platformAvailability.episodeFrom,
        episodeTo: platformAvailability.episodeTo,
      })
      .from(platformAvailability)
      .innerJoin(platform, eq(platformAvailability.platformId, platform.id))
      .where(
        and(
          inArray(platformAvailability.animeId, ids),
          or(isNull(platformAvailability.availableTo), gt(platformAvailability.availableTo, now)),
        ),
      )
      .orderBy(desc(platformAvailability.verifiedAt)),
  ]);

  const titlesByAnime = new Map<string, TitleRow[]>();
  for (const row of titleRows) {
    titlesByAnime.set(row.animeId, [
      ...(titlesByAnime.get(row.animeId) ?? []),
      { locale: row.locale, title: row.title, synopsis: row.synopsis, source: row.source },
    ]);
  }

  const platformsByAnime = new Map<string, PlatformChip[]>();
  for (const row of platformRows) {
    platformsByAnime.set(row.animeId, [
      ...(platformsByAnime.get(row.animeId) ?? []),
      {
        platformName: row.platformName,
        platformUrl: row.platformUrl,
        audioLangs: row.audioLangs,
        subLangs: row.subLangs,
        availableTo: row.availableTo,
        verifiedAt: row.verifiedAt,
        coversAllEpisodes: row.coversAllEpisodes,
        episodeFrom: row.episodeFrom,
        episodeTo: row.episodeTo,
      },
    ]);
  }

  for (const row of animeRows) {
    result.set(row.id, {
      animeId: row.id,
      slug: row.slug,
      titleRomaji: row.titleRomaji,
      titles: titlesByAnime.get(row.id) ?? [],
      coverUrl: row.coverUrl,
      status: row.status,
      entryKind: row.entryKind,
      seasonLabel: row.seasonLabel,
      seriesSlug: row.seriesSlug,
      seriesTitle: row.seriesTitle,
      episodeCount: row.episodeCount,
      latestAiredStored: row.latestAiredEpisode,
      episodes: episodesByAnime.get(row.id) ?? [],
      platforms: platformsByAnime.get(row.id) ?? [],
      lastAiredAt: null,
      nextAirAt: null,
      nextEpisode: null,
    });
  }
  return result;
}

// Corner badge for an entry, computed from the stored fields and the active platform rows.
export function cornerBadgeFor(entry: FeedEntry, now: Date): CornerBadge {
  return computeCornerBadge({
    status: entry.status,
    entryKind: entry.entryKind,
    episodeCount: entry.episodeCount,
    latestAired: resolveLatestAired(entry.latestAiredStored, entry.episodes, now),
    availability: entry.platforms,
    now,
  });
}
