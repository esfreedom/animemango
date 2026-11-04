import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { PosterCard } from "@/components/anime/PosterCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSeasonAnime } from "@/data/catalog";
import { localeAlternates } from "@/lib/alternates";
import { preparePage } from "@/lib/page";
import { currentSeason, parseSeasonSlug, seasonSlug } from "@/lib/slug";
import { resolveTitle } from "@/lib/titles";

export async function generateMetadata({ params }: PageProps<"/[locale]/season/[slug]">) {
  const { locale, slug } = await params;
  return { alternates: localeAlternates(locale, `/season/${slug}`) };
}

export default async function SeasonPage({ params }: PageProps<"/[locale]/season/[slug]">) {
  const locale = await preparePage(params);
  const { slug } = await params;

  if (slug === "current") {
    const { year, season } = currentSeason();
    redirect(`/${locale}/season/${seasonSlug(year, season)}`);
  }

  const parsed = parseSeasonSlug(slug);
  if (!parsed) notFound();

  const t = await getTranslations("season");
  const tStatus = await getTranslations("status");
  const items = await getSeasonAnime(parsed.year, parsed.season);
  const seasonName = t(parsed.season);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-ink">
          {t("title", { season: seasonName, year: parsed.year })}
        </h1>
        <p className="text-sm text-muted">{t("sortNote")}</p>
      </header>

      {items.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 md:gap-4">
          {items.map((item) => {
            const title = resolveTitle(item.titles, locale, item.titleRomaji);
            return (
              <li key={item.id}>
                <PosterCard
                  href={`/anime/${item.slug}`}
                  title={title.title}
                  coverUrl={item.coverUrl}
                  meta={item.averageScore ? `★ ${item.averageScore}%` : undefined}
                  tags={<Badge>{tStatus(item.status as "upcoming" | "airing" | "finished" | "hiatus")}</Badge>}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
