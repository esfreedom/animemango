import { getTranslations } from "next-intl/server";
import { PosterCard } from "@/components/anime/PosterCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getGenres, getPlatforms, searchAnime } from "@/data/catalog";
import { preparePage } from "@/lib/page";
import { resolveTitle } from "@/lib/titles";

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

export default async function SearchPage({ params, searchParams }: PageProps<"/[locale]/search">) {
  const locale = await preparePage(params);
  const query = await searchParams;
  const read = (key: string) => {
    const value = query[key];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
  };

  const filters = {
    query: read("q"),
    genre: read("genre"),
    thaiDub: read("dub") === "1",
    thaiSub: read("sub") === "1",
    platformId: read("platform") ? Number(read("platform")) : undefined,
  };

  const t = await getTranslations("search");
  const tStatus = await getTranslations("status");
  const [genres, platforms, results] = await Promise.all([
    getGenres(),
    getPlatforms(),
    searchAnime(filters),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>

      <form method="get" className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs text-muted md:col-span-2">
          {t("query")}
          <input
            name="q"
            defaultValue={filters.query ?? ""}
            className="h-9 rounded-md border border-line bg-canvas px-3 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t("genre")}
          <select name="genre" defaultValue={filters.genre ?? ""} className="h-9 rounded-md border border-line bg-canvas px-2 text-sm text-ink">
            <option value="">{t("allGenres")}</option>
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          {t("platform")}
          <select name="platform" defaultValue={read("platform") ?? ""} className="h-9 rounded-md border border-line bg-canvas px-2 text-sm text-ink">
            <option value="">{t("allPlatforms")}</option>
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col justify-end gap-2 text-sm text-ink">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="dub" value="1" defaultChecked={filters.thaiDub} />
            {t("thaiDub")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="sub" value="1" defaultChecked={filters.thaiSub} />
            {t("thaiSub")}
          </label>
        </div>
        <div className="flex items-end">
          <button type="submit" className="h-9 w-full rounded-md bg-accent px-4 text-sm font-semibold text-on-accent">
            {t("submit")}
          </button>
        </div>
      </form>

      {results.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 md:gap-4">
          {results.map((item) => {
            const title = resolveTitle(item.titles, locale, item.titleRomaji);
            return (
              <li key={item.id}>
                <PosterCard
                  href={`/anime/${item.slug}`}
                  title={title.title}
                  coverUrl={item.coverUrl}
                  meta={item.genres.slice(0, 2).join(" · ") || undefined}
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
