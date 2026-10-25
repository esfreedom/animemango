// Corner badge on a poster (approved plan, section 3). Pure, so it is easy to test and
// the AI cannot set it. It is derived from the episode dates and verified availability only.

export const COVERAGE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type BadgeEpisode = { number: number; airAtUtc: Date | null };

export type BadgeAvailability = {
  availableTo: Date | null;
  verifiedAt: Date;
  coversAllEpisodes: boolean;
  episodeFrom: number | null;
  episodeTo: number | null;
};

export type BadgeInput = {
  status: "upcoming" | "airing" | "finished" | "hiatus";
  // Movies and specials have no "latest episode" worth showing, so only END applies to them.
  entryKind: "tv" | "movie" | "ova" | "special";
  episodeCount: number | null;
  // Resolved with resolveLatestAired. Null when nothing has aired yet.
  latestAired: number | null;
  availability: BadgeAvailability[];
  now: Date;
};

export type CornerBadge = { kind: "ep"; number: number } | { kind: "end" } | { kind: "none" };

export function computeCornerBadge(input: BadgeInput): CornerBadge {
  if (input.status === "finished" && hasCompleteLicensedCopy(input)) {
    return { kind: "end" };
  }

  if (input.entryKind !== "tv") return { kind: "none" };

  if (input.latestAired !== null) return { kind: "ep", number: input.latestAired };

  if (input.status === "finished" && input.episodeCount) {
    return { kind: "ep", number: input.episodeCount };
  }

  return { kind: "none" };
}

// The stored value comes from AniList (nextAiringEpisode), which knows about episodes outside
// the sync window. Episode rows are the fallback.
export function resolveLatestAired(stored: number | null, episodes: BadgeEpisode[], now: Date): number | null {
  if (stored !== null) return stored;
  const aired = episodes
    .filter((episode) => episode.airAtUtc !== null && episode.airAtUtc.getTime() <= now.getTime())
    .map((episode) => episode.number);
  return aired.length > 0 ? Math.max(...aired) : null;
}

// END needs one verified, still-active licensed copy that has every episode. Coverage can
// be given as a flag or as an episode range that starts at 1 and reaches the last episode.
export function hasCompleteLicensedCopy(input: BadgeInput): boolean {
  return input.availability.some((item) => {
    if (item.availableTo && item.availableTo.getTime() <= input.now.getTime()) return false;
    if (input.now.getTime() - item.verifiedAt.getTime() > COVERAGE_MAX_AGE_MS) return false;
    if (item.coversAllEpisodes) return true;
    return (
      input.episodeCount !== null &&
      item.episodeFrom !== null &&
      item.episodeTo !== null &&
      item.episodeFrom <= 1 &&
      item.episodeTo >= input.episodeCount
    );
  });
}
