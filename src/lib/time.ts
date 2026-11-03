// All times are stored in UTC. Display uses the viewer's zone, with Asia/Bangkok as default.
export const DISPLAY_TIME_ZONES = [
  "Asia/Bangkok",
  "Asia/Tokyo",
  "UTC",
  "Europe/London",
  "America/New_York",
] as const;
export type DisplayTimeZone = (typeof DISPLAY_TIME_ZONES)[number];

export const DEFAULT_TIME_ZONE: DisplayTimeZone = "Asia/Bangkok";

// Keys in the "timezones" messages, one per option.
export const TIME_ZONE_LABEL_KEY: Record<DisplayTimeZone, "bangkok" | "tokyo" | "utc" | "london" | "new_york"> = {
  "Asia/Bangkok": "bangkok",
  "Asia/Tokyo": "tokyo",
  UTC: "utc",
  "Europe/London": "london",
  "America/New_York": "new_york",
};

export function parseTimeZone(value: string | undefined): DisplayTimeZone {
  return (DISPLAY_TIME_ZONES as readonly string[]).includes(value ?? "")
    ? (value as DisplayTimeZone)
    : DEFAULT_TIME_ZONE;
}

// Thai uses the Buddhist calendar by default. The gregory extension keeps years
// consistent with the stored dates.
const intlLocale: Record<string, string> = {
  th: "th-TH-u-ca-gregory",
  en: "en-US",
  ja: "ja-JP",
};

export function formatAirTime(date: Date, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(intlLocale[locale] ?? "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

// Start and end (exclusive) of the calendar day in Asia/Bangkok that contains `now`.
// Bangkok has no daylight saving time, so a fixed +07:00 offset is exact.
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function bangkokDayRange(now: Date): { from: Date; to: Date } {
  const shifted = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const midnightUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  const from = new Date(midnightUtc - BANGKOK_OFFSET_MS);
  return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
}
