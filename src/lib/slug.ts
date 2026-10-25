export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "anime";
}

// Season slugs look like "2026-fall" (DESIGN.md section 2).
export const SEASONS = ["winter", "spring", "summer", "fall"] as const;
export type Season = (typeof SEASONS)[number];

export function parseSeasonSlug(slug: string): { year: number; season: Season } | null {
  const match = /^(\d{4})-(winter|spring|summer|fall)$/.exec(slug);
  if (!match) return null;
  return { year: Number(match[1]), season: match[2] as Season };
}

// Season of a date in Asia/Bangkok, using broadcast seasons (Jan-Mar winter, and so on).
export function currentSeason(now: Date = new Date()): { year: number; season: Season } {
  const bangkok = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const month = bangkok.getUTCMonth();
  const season: Season = month < 3 ? "winter" : month < 6 ? "spring" : month < 9 ? "summer" : "fall";
  return { year: bangkok.getUTCFullYear(), season };
}

export function seasonSlug(year: number, season: Season): string {
  return `${year}-${season}`;
}
