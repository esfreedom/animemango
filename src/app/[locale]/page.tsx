import { getTranslations } from "next-intl/server";
import { PosterCard } from "@/components/anime/PosterCard";
import { LangTags } from "@/components/anime/LangTags";
import { Section } from "@/components/ui/Section";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import {
  getAiringBetween,
  getAnnouncements,
  getAvailabilityChanges,
  getHotThreads,
  type AiringItem,
} from "@/data/catalog";
import { resolveTitle } from "@/lib/titles";
import { bangkokDayRange, formatAirTime } from "@/lib/time";
import { preparePage } from "@/lib/page";

const DAY_MS = 24 * 60 * 60 * 1000;

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await preparePage(params);
  const t = await getTranslations("home");
  const now = new Date();
  const today = bangkokDayRange(now);

  const [airingToday, upcoming, announcements, changes, hot] = await Promise.all([
    getAiringBetween(today.from, today.to),
    getAiringBetween(today.to, new Date(now.getTime() + 7 * DAY_MS)),
    getAnnouncements(),
    getAvailabilityChanges(),
    getHotThreads(new Date(now.getTime() - DAY_MS)),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-muted">{t("subtitle")}</p>
      </section>

      <Section id="airing-today" title={t("sections.airingToday")}>
        <EpisodeGrid items={airingToday} locale={locale} emptyMessage={t("empty")} />
      </Section>

      <Section id="upcoming" title={t("sections.upcoming")}>
        <EpisodeGrid items={upcoming.slice(0, 12)} locale={locale} emptyMessage={t("empty")} />
      </Section>

      <Section id="announcements" title={t("sections.announcements")}>
        {announcements.length === 0 ? (
          <EmptyState message={t("empty")} />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {announcements.map((item) => (
              <li key={item.id} className="space-y-1 p-4">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ink underline-offset-4 hover:underline"
                >
                  {item.title}
                </a>
                <p className="text-xs text-muted">
                  {item.sourceName} · {formatAirTime(item.publishedAt, locale, "Asia/Bangkok")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="availability-changes" title={t("sections.availabilityChanges")}>
        {changes.length === 0 ? (
          <EmptyState message={t("empty")} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {changes.map((item, index) => (
              <li key={`${item.animeSlug}-${index}`} className="rounded-lg border border-line bg-surface p-4">
                <AvailabilityChangeLine item={item} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="hot-threads" title={t("sections.hotThreads")}>
        {hot.length === 0 ? (
          <EmptyState message={t("empty")} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {hot.map((item) => {
              const title = resolveTitle(item.titles, locale, item.romaji).title;
              const href = item.episodeNumber
                ? `/anime/${item.slug}/ep/${item.episodeNumber}`
                : `/anime/${item.slug}`;
              return (
                <li key={item.threadId}>
                  <Link href={href} className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-4 hover:bg-raised">
                    <span className="font-medium text-ink">
                      {title}
                      {item.episodeNumber ? ` · ${item.episodeNumber}` : ""}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{t("threadComments", { count: item.total })}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

async function EpisodeGrid({
  items,
  locale,
  emptyMessage,
}: {
  items: AiringItem[];
  locale: string;
  emptyMessage: string;
}) {
  const t = await getTranslations("episode");
  const tStatus = await getTranslations("status");

  if (items.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 md:gap-4">
      {items.map((item, index) => {
        const title = resolveTitle(item.titles, locale, item.titleRomaji);
        return (
          <li key={`${item.slug}-${item.number}`}>
            <PosterCard
              href={`/anime/${item.slug}/ep/${item.number}`}
              title={title.title}
              coverUrl={item.coverUrl}
              priority={index < 6}
              meta={`${t("title", { number: item.number })} · ${formatAirTime(item.airAtUtc, locale, "Asia/Bangkok")}`}
              tags={
                <span className="flex flex-wrap gap-1">
                  <Badge>{tStatus(item.status as "scheduled" | "aired" | "delayed")}</Badge>
                </span>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

async function AvailabilityChangeLine({
  item,
  locale,
}: {
  item: Awaited<ReturnType<typeof getAvailabilityChanges>>[number];
  locale: string;
}) {
  const t = await getTranslations("availability");
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink">
        <Link href={`/anime/${item.animeSlug}`} className="font-medium underline-offset-4 hover:underline">
          {item.titleRomaji}
        </Link>
      </p>
      <p className="text-xs text-muted">
        {t(item.event)} · {item.platformName} · {formatAirTime(item.occurredAt, locale, "Asia/Bangkok")}
      </p>
      <LangTags audio={item.audioLangs} subs={item.subLangs} />
    </div>
  );
}
