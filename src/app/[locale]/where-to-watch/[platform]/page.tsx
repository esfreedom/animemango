import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { PosterCard } from "@/components/anime/PosterCard";
import { LangTags } from "@/components/anime/LangTags";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPlatforms, getWhereToWatch } from "@/data/catalog";
import { preparePage } from "@/lib/page";
import { slugify } from "@/lib/slug";
import { resolveTitle } from "@/lib/titles";
import { formatAirTime } from "@/lib/time";

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

export default async function WhereToWatchPage({ params }: PageProps<"/[locale]/where-to-watch/[platform]">) {
  const locale = await preparePage(params);
  const { platform: platformSlug } = await params;

  // Platforms are matched by slug, so the URL stays readable.
  const platforms = await getPlatforms();
  const platform = platforms.find((item) => slugify(item.name) === platformSlug);
  if (!platform) notFound();

  const t = await getTranslations("where");
  const tAvailability = await getTranslations("availability");
  const items = await getWhereToWatch(platform.id);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-ink">{t("title", { platform: platform.name })}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
        <a href={platform.officialUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-ink underline-offset-4 hover:underline">
          {tAvailability("visit")}
        </a>
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
                  meta={`${tAvailability("verifiedAt", { date: formatAirTime(item.verifiedAt, locale, "Asia/Bangkok") })}`}
                  tags={<LangTags audio={item.audioLangs} subs={item.subLangs} />}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
