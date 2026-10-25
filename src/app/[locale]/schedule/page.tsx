import { getTranslations } from "next-intl/server";
import { PosterCard } from "@/components/anime/PosterCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAiringBetween, type AiringItem } from "@/data/catalog";
import { preparePage } from "@/lib/page";
import { resolveTitle } from "@/lib/titles";
import { DISPLAY_TIME_ZONES, formatAirTime, parseTimeZone } from "@/lib/time";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

export default async function SchedulePage({ params, searchParams }: PageProps<"/[locale]/schedule">) {
  const locale = await preparePage(params);
  const { tz } = await searchParams;
  const zone = parseTimeZone(typeof tz === "string" ? tz : undefined);
  const t = await getTranslations("schedule");

  const now = new Date();
  const items = await getAiringBetween(now, new Date(now.getTime() + WEEK_MS), 300);

  // Group by calendar day in the viewer's zone.
  const days = new Map<string, AiringItem[]>();
  for (const item of items) {
    const key = dayKey(item.airAtUtc, zone);
    days.set(key, [...(days.get(key) ?? []), item]);
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t("timezone")}
          <select name="tz" defaultValue={zone} className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink">
            {DISPLAY_TIME_ZONES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md border border-line bg-surface px-4 text-sm text-ink hover:bg-raised">
          {t("apply")}
        </button>
      </form>

      {days.size === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        [...days.entries()].map(([key, dayItems]) => (
          <section key={key} aria-labelledby={`day-${key}`} className="space-y-4">
            <h2 id={`day-${key}`} className="text-lg font-semibold text-ink">
              {formatDayLabel(dayItems[0].airAtUtc, locale, zone)}
            </h2>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 md:gap-4">
              {dayItems.map((item) => {
                const title = resolveTitle(item.titles, locale, item.titleRomaji);
                return (
                  <li key={`${item.slug}-${item.number}`}>
                    <PosterCard
                      href={`/anime/${item.slug}/ep/${item.number}`}
                      title={title.title}
                      coverUrl={item.coverUrl}
                      meta={formatAirTime(item.airAtUtc, locale, zone)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

// "2026-10-25" in the given zone. Used as a stable key and for grouping.
function dayKey(date: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zone }).format(date);
}

function formatDayLabel(date: Date, locale: string, zone: string): string {
  const intlLocale = locale === "th" ? "th-TH-u-ca-gregory" : locale === "ja" ? "ja-JP" : "en-US";
  return new Intl.DateTimeFormat(intlLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: zone,
  }).format(date);
}

