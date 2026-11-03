// Groups home-feed entries into one card per series (franchise), so a season or movie never gets
// its own card next to the others. Pure, so it can be tested without a database.

const DAY_MS = 24 * 60 * 60 * 1000;

// A card counts as new for this long after its latest episode aired.
export const NEW_WINDOW_MS = DAY_MS;
// Each card lists at most this many recent episodes.
export const RECENT_LIMIT = 3;

export type CardEpisode = { number: number; airAtUtc: Date | null };

export type CardEntry = {
  slug: string;
  seriesSlug: string | null;
  lastAiredAt: Date | null;
  nextAirAt: Date | null;
  nextEpisode: number | null;
  episodes: CardEpisode[];
};

export type SeriesCard<T extends CardEntry> = {
  key: string;
  // The entry shown as the cover: the one that aired most recently, or the next one to air.
  primary: T;
  members: T[];
  lastAiredAt: Date | null;
  nextAirAt: Date | null;
  nextEpisode: number | null;
  recent: { member: T; number: number; airedAt: Date }[];
  isNew: boolean;
};

export function groupIntoSeriesCards<T extends CardEntry>(entries: T[], now: Date): SeriesCard<T>[] {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const key = entry.seriesSlug ? `series:${entry.seriesSlug}` : `anime:${entry.slug}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const cards = [...groups].map(([key, members]) => {
    let lastAired: T | null = null;
    let lastAiredAt: Date | null = null;
    let soonest: T | null = null;
    let nextAirAt: Date | null = null;
    for (const member of members) {
      if (member.lastAiredAt && (lastAiredAt === null || member.lastAiredAt > lastAiredAt)) {
        lastAired = member;
        lastAiredAt = member.lastAiredAt;
      }
      if (member.nextAirAt && (nextAirAt === null || member.nextAirAt < nextAirAt)) {
        soonest = member;
        nextAirAt = member.nextAirAt;
      }
    }

    const primary = lastAired ?? soonest ?? members[0];
    const recent = members
      .flatMap((member) =>
        member.episodes.flatMap((episode) =>
          episode.airAtUtc && episode.airAtUtc.getTime() <= now.getTime()
            ? [{ member, number: episode.number, airedAt: episode.airAtUtc }]
            : [],
        ),
      )
      .sort((a, b) => b.airedAt.getTime() - a.airedAt.getTime())
      .slice(0, RECENT_LIMIT);

    return {
      key,
      primary,
      members,
      lastAiredAt,
      nextAirAt,
      nextEpisode: soonest?.nextEpisode ?? null,
      recent,
      isNew: lastAiredAt !== null && now.getTime() - lastAiredAt.getTime() < NEW_WINDOW_MS,
    };
  });

  // Series that aired recently come first, newest first. Upcoming-only series follow, soonest first.
  return cards.sort((a, b) => {
    if (a.lastAiredAt && b.lastAiredAt) return b.lastAiredAt.getTime() - a.lastAiredAt.getTime();
    if (a.lastAiredAt) return -1;
    if (b.lastAiredAt) return 1;
    return (a.nextAirAt?.getTime() ?? 0) - (b.nextAirAt?.getTime() ?? 0);
  });
}
