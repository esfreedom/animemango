import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PosterCard } from "@/components/anime/PosterCard";
import { LangTags } from "@/components/anime/LangTags";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { cornerBadgeFor, getSeriesEntries, type FeedEntry } from "@/data/feed";
import { routing } from "@/i18n/routing";
import { localeAlternates } from "@/lib/alternates";
import { preparePage } from "@/lib/page";
import { resolveTitle } from "@/lib/titles";
import { JsonLd } from "@/components/seo/JsonLd";

type Props = PageProps<"/[locale]/series/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await connection();

  const data = await getSeriesEntries(slug, new Date());
  if (!data) return { title: "404" };

  return {
    title: data.series.titleRomaji,
    alternates: localeAlternates(locale, `/series/${slug}`),
  };
}

export default async function SeriesPage({ params }: Props) {
  const locale = await preparePage(params);
  const { slug } = await params;
  const now = new Date();

  const data = await getSeriesEntries(slug, now);
  if (!data) notFound();

  const t = await getTranslations("series");
  const kindLabel = await getTranslations("series.kind");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: data.series.titleRomaji,
    url: `/${locale}/series/${slug}`,
    numberOfEpisodes: data.entries.reduce((sum, entry) => sum + (entry.episodeCount ?? 0), 0) || undefined,
    inLanguage: locale,
  };

  return (
    <div className="space-y-8">
      <JsonLd data={jsonLd} />
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-ink">{t("title", { title: data.series.titleRomaji })}</h1>
        <p className="text-sm text-muted">{t("seasons")}</p>
      </header>

      {data.entries.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 md:gap-4">
          {data.entries.map((entry) => (
            <li key={entry.animeId}>
              <SeriesEntryCard entry={entry} locale={locale} now={now} kindLabel={kindLabel(entry.entryKind)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function SeriesEntryCard({
  entry,
  locale,
  now,
  kindLabel,
}: {
  entry: FeedEntry;
  locale: string;
  now: Date;
  kindLabel: string;
}) {
  const tAvailability = await getTranslations("availability");
  const title = resolveTitle(entry.titles, locale, entry.titleRomaji).title;
  const badge = cornerBadgeFor(entry, now);
  const corner =
    badge.kind === "end" ? (
      <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold leading-none text-on-accent">END</span>
    ) : badge.kind === "ep" ? (
      <span className="rounded bg-canvas/90 px-1.5 py-0.5 text-[11px] font-bold leading-none text-ink">EP {badge.number}</span>
    ) : null;

  return (
    <PosterCard
      href={`/anime/${entry.slug}`}
      title={title}
      coverUrl={entry.coverUrl}
      corner={corner}
      meta={[kindLabel, entry.seasonLabel].filter(Boolean).join(" · ")}
      tags={
        entry.platforms.length > 0 ? (
          <ul className="space-y-1" aria-label={tAvailability("title")}>
            {entry.platforms.slice(0, 3).map((platform) => (
              <li key={platform.platformName} className="flex flex-wrap items-center gap-1">
                <Badge>{platform.platformName}</Badge>
                <LangTags audio={platform.audioLangs} subs={platform.subLangs} />
              </li>
            ))}
          </ul>
        ) : undefined
      }
    />
  );
}
