import { getTranslations } from "next-intl/server";
import { SeriesCard } from "@/components/anime/SeriesCard";
import { LangTags } from "@/components/anime/LangTags";
import { LiveRefresh } from "@/components/layout/LiveRefresh";
import { Section } from "@/components/ui/Section";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/i18n/navigation";
import { getAnnouncements, getAvailabilityChanges, getHotThreads } from "@/data/catalog";
import { getSeriesHomeFeed } from "@/data/feed";
import { resolveTitle } from "@/lib/titles";
import { formatAirTime } from "@/lib/time";
import { localeAlternates } from "@/lib/alternates";
import { preparePage } from "@/lib/page";
import { readPrefs } from "@/lib/prefs-server";
import { getCurrentUser } from "@/lib/session";
import { PrefsControl } from "@/components/prefs/PrefsControl";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  return { alternates: localeAlternates(locale, "") };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await preparePage(params);
  const t = await getTranslations("home");
  const now = new Date();

  const user = await getCurrentUser();
  const [cards, announcements, changes, hot, prefs] = await Promise.all([
    getSeriesHomeFeed(now),
    getAnnouncements(),
    getAvailabilityChanges(),
    getHotThreads(new Date(now.getTime() - DAY_MS)),
    readPrefs(user),
  ]);
  // One card per series. Series that aired recently are listed first, then the ones still upcoming.
  const updated = cards.filter((card) => card.lastAiredAt !== null);
  const upcoming = cards.filter((card) => card.lastAiredAt === null);

  return (
    <div className="flex flex-col gap-12">
      <LiveRefresh />
      <section className="space-y-3">
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-muted">{t("subtitle")}</p>
        <PrefsControl prefs={prefs} />
      </section>

      <Section id="latest-updates" title={t("sections.airingToday")}>
        {updated.length === 0 ? (
          <EmptyState message={t("empty")} />
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6 md:gap-5">
            {updated.map((card, index) => (
              <li key={card.key}>
                <SeriesCard card={card} locale={locale} now={now} prefs={prefs} priority={index < 6} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="upcoming" title={t("sections.upcoming")}>
        {upcoming.length === 0 ? (
          <EmptyState message={t("empty")} />
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6 md:gap-5">
            {upcoming.map((card) => (
              <li key={card.key}>
                <SeriesCard card={card} locale={locale} now={now} prefs={prefs} />
              </li>
            ))}
          </ul>
        )}
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
