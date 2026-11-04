import { and, eq } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { anime, animeI18n, episode, series } from "@/db/schema";
import { GUIDES } from "@/content/guides";
import { routing } from "@/i18n/routing";
import { currentSeason, seasonSlug } from "@/lib/slug";
import { getSiteUrl } from "@/lib/site";

// One entry per locale for every page, with hreflang alternates (DESIGN.md section 10).
// Titles without Thai content are left out, because their pages are noindex.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const db = getDb();

  const thaiRows = await db
    .select({ slug: anime.slug })
    .from(anime)
    .innerJoin(animeI18n, eq(animeI18n.animeId, anime.id))
    .where(and(eq(animeI18n.locale, "th"), eq(anime.published, true)));
  const withThai = new Set(thaiRows.map((row) => row.slug));

  const titles = (await db.select({ slug: anime.slug, updatedAt: anime.updatedAt }).from(anime)).filter((row) =>
    withThai.has(row.slug),
  );

  const episodes = (
    await db
      .select({ slug: anime.slug, number: episode.number, updatedAt: anime.updatedAt })
      .from(episode)
      .innerJoin(anime, eq(episode.animeId, anime.id))
      .limit(5000)
  ).filter((row) => withThai.has(row.slug));

  const seriesRows = await db.select({ slug: series.slug, updatedAt: series.updatedAt }).from(series);

  const { year, season } = currentSeason();
  const paths: { path: string; lastModified?: Date }[] = [
    { path: "" },
    { path: "/schedule" },
    { path: `/season/${seasonSlug(year, season)}` },
    { path: "/search" },
    { path: "/guides" },
    ...GUIDES.map((guide) => ({ path: `/guides/${guide.slug}`, lastModified: new Date(guide.updated) })),
    ...seriesRows.map((row) => ({ path: `/series/${row.slug}`, lastModified: row.updatedAt })),
    ...titles.map((row) => ({ path: `/anime/${row.slug}`, lastModified: row.updatedAt })),
    ...episodes.map((row) => ({ path: `/anime/${row.slug}/ep/${row.number}`, lastModified: row.updatedAt })),
  ];

  const site = getSiteUrl();
  return paths.flatMap(({ path, lastModified }) =>
    routing.locales.map((locale) => ({
      url: `${site}/${locale}${path}`,
      lastModified,
      alternates: {
        languages: Object.fromEntries([
          ...routing.locales.map((code) => [code, `${site}/${code}${path}`]),
          ["x-default", `${site}/${routing.defaultLocale}${path}`],
        ]),
      },
    })),
  );
}
