import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { anime, platform, series } from "@/db/schema";
import { checkOpsToken } from "@/lib/ops-auth";

// Read-only view for the AI: titles, entries, and the platforms that proposals may cite.
// It never includes comments, users, or the email of anyone.
export async function GET(request: Request) {
  const auth = checkOpsToken(request.headers.get("authorization"), process.env.OPS_API_TOKEN);
  if (auth === "not_configured") return Response.json({ error: "OPS_API_TOKEN is not set" }, { status: 503 });
  if (auth === "unauthorized") return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = getDb();
  const [seriesRows, animeRows, platformRows] = await Promise.all([
    db.select({ id: series.id, slug: series.slug, titleRomaji: series.titleRomaji }).from(series).orderBy(asc(series.slug)).limit(500),
    db
      .select({
        slug: anime.slug,
        titleRomaji: anime.titleRomaji,
        seriesId: anime.seriesId,
        entryKind: anime.entryKind,
        seasonLabel: anime.seasonLabel,
        sortOrder: anime.sortOrder,
        status: anime.status,
        episodeCount: anime.episodeCount,
        latestAiredEpisode: anime.latestAiredEpisode,
      })
      .from(anime)
      .orderBy(asc(anime.titleRomaji))
      .limit(2000),
    db.select({ name: platform.name, officialUrl: platform.officialUrl, regions: platform.regions }).from(platform).orderBy(asc(platform.name)),
  ]);

  const slugBySeries = new Map(seriesRows.map((row) => [row.id, row.slug]));
  return Response.json({
    series: seriesRows.map((row) => ({ slug: row.slug, titleRomaji: row.titleRomaji })),
    anime: animeRows.map(({ seriesId, ...rest }) => ({ ...rest, seriesSlug: seriesId ? (slugBySeries.get(seriesId) ?? null) : null })),
    platforms: platformRows,
  });
}
