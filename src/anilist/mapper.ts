import type { AniListAiringEntry, AniListMedia } from "./client";

export type AnimeStatus = "upcoming" | "airing" | "finished" | "hiatus";

export type MappedAnime = {
  anilistId: number;
  malId: number | null;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
  format: string | null;
  episodeCount: number | null;
  genres: string[];
  averageScore: number | null;
  status: AnimeStatus;
  season: "winter" | "spring" | "summer" | "fall" | null;
  seasonYear: number | null;
  startDate: string | null;
  coverUrl: string | null;
  bannerUrl: string | null;
};

const STATUS: Record<string, AnimeStatus> = {
  RELEASING: "airing",
  NOT_YET_RELEASED: "upcoming",
  FINISHED: "finished",
  CANCELLED: "finished",
  HIATUS: "hiatus",
};

const SEASON: Record<string, MappedAnime["season"]> = {
  WINTER: "winter",
  SPRING: "spring",
  SUMMER: "summer",
  FALL: "fall",
};

export function mapStatus(value: string | null): AnimeStatus {
  return (value && STATUS[value]) || "upcoming";
}

export function mapMedia(media: AniListMedia): MappedAnime | null {
  // Adult titles are skipped. Age-gated content is out of scope for now (DESIGN.md section 13).
  if (media.isAdult) return null;

  const { year, month, day } = media.startDate ?? {};
  const startDate =
    year && month && day
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : null;

  return {
    anilistId: media.id,
    malId: media.idMal,
    titleRomaji: media.title.romaji ?? media.title.english ?? `anime-${media.id}`,
    titleEnglish: media.title.english,
    titleNative: media.title.native,
    format: media.format,
    episodeCount: media.episodes,
    genres: media.genres ?? [],
    averageScore: media.averageScore,
    status: mapStatus(media.status),
    season: (media.season && SEASON[media.season]) || null,
    seasonYear: media.seasonYear,
    startDate,
    coverUrl: media.coverImage?.extraLarge ?? null,
    bannerUrl: media.bannerImage,
  };
}

// Groups airing entries by AniList media id, keeping only the episodes in the window.
export function groupByMedia(entries: AniListAiringEntry[]) {
  const groups = new Map<number, { anime: MappedAnime; episodes: { number: number; airingAt: Date }[] }>();

  for (const entry of entries) {
    const anime = mapMedia(entry.media);
    if (!anime) continue;

    const group = groups.get(anime.anilistId) ?? { anime, episodes: [] };
    group.episodes.push({ number: entry.episode, airingAt: new Date(entry.airingAt * 1000) });
    groups.set(anime.anilistId, group);
  }

  return [...groups.values()];
}
