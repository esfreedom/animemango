import { desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  proposal,
  anime,
  officialChannel,
  platform,
  platformAvailability,
  series,
  takedownRequest,
} from "@/db/schema";

// Admin queries are read on each request, never cached, so the queues are always current.

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

