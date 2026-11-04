import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  proposal,
  anime,
  animeI18n,
  officialChannel,
  platform,
  platformAvailability,
  series,
  takedownRequest,
} from "@/db/schema";

// Admin queries are read on each request, never cached, so the queues are always current.

export type AnimeShow = "all" | "published" | "draft";

// The anime list. Each title shows its official Thai name when there is one, and how many platforms carry it.
export async function listAnimeForAdmin(show: AnimeShow, limit = 300) {
  const db = getDb();
  const filter = show === "published" ? eq(anime.published, true) : show === "draft" ? eq(anime.published, false) : undefined;

  const rows = await db
    .select({
      id: anime.id,
      slug: anime.slug,
      titleRomaji: anime.titleRomaji,
      format: anime.format,
      status: anime.status,
      episodeCount: anime.episodeCount,
      published: anime.published,
    })
    .from(anime)
    .where(filter)
    .orderBy(desc(anime.updatedAt))
    .limit(limit);

  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];

  const [thaiRows, platformRows] = await Promise.all([
    db
      .select({ animeId: animeI18n.animeId, title: animeI18n.title })
      .from(animeI18n)
      .where(and(inArray(animeI18n.animeId, ids), eq(animeI18n.locale, "th"))),
    db
      .select({ animeId: platformAvailability.animeId, total: count() })
      .from(platformAvailability)
      .where(inArray(platformAvailability.animeId, ids))
      .groupBy(platformAvailability.animeId),
  ]);

  const thaiByAnime = new Map(thaiRows.map((row) => [row.animeId, row.title]));
  const platformsByAnime = new Map(platformRows.map((row) => [row.animeId, Number(row.total)]));

  return rows.map((row) => ({
    ...row,
    titleTh: thaiByAnime.get(row.id) ?? null,
    platformCount: platformsByAnime.get(row.id) ?? 0,
  }));
}

// Counts for the tabs on the anime list.
export async function countAnimeByPublished() {
  const rows = await getDb()
    .select({ published: anime.published, total: count() })
    .from(anime)
    .groupBy(anime.published);

  const published = Number(rows.find((row) => row.published)?.total ?? 0);
  const draft = Number(rows.find((row) => !row.published)?.total ?? 0);
  return { all: published + draft, published, draft };
}

export async function getPendingProposals(limit = 50) {
  return getDb()
    .select({
      id: proposal.id,
      kind: proposal.kind,
      payload: proposal.payload,
      sources: proposal.sources,
      aiModel: proposal.aiModel,
      promptVersion: proposal.promptVersion,
      createdAt: proposal.createdAt,
      animeTitle: anime.titleRomaji,
      seriesTitle: series.titleRomaji,
    })
    .from(proposal)
    .leftJoin(anime, eq(proposal.animeId, anime.id))
    .leftJoin(series, eq(proposal.seriesId, series.id))
    .where(eq(proposal.status, "pending"))
    .orderBy(desc(proposal.createdAt))
    .limit(limit);
}

export async function getOpenTakedowns(limit = 50) {
  return getDb()
    .select()
    .from(takedownRequest)
    .where(eq(takedownRequest.status, "open"))
    .orderBy(desc(takedownRequest.createdAt))
    .limit(limit);
}

export async function getActiveAvailability(limit = 100) {
  return getDb()
    .select({
      id: platformAvailability.id,
      animeTitle: anime.titleRomaji,
      animeSlug: anime.slug,
      platformName: platform.name,
      audioLangs: platformAvailability.audioLangs,
      subLangs: platformAvailability.subLangs,
    })
    .from(platformAvailability)
    .innerJoin(anime, eq(platformAvailability.animeId, anime.id))
    .innerJoin(platform, eq(platformAvailability.platformId, platform.id))
    .where(isNull(platformAvailability.availableTo))
    .orderBy(desc(platformAvailability.verifiedAt))
    .limit(limit);
}

export async function getOfficialChannels() {
  return getDb().select().from(officialChannel).orderBy(officialChannel.name);
}

