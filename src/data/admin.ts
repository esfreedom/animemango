import { desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  aiDraft,
  anime,
  officialChannel,
  platform,
  platformAvailability,
  takedownRequest,
} from "@/db/schema";

// Admin queries are read on each request, never cached, so the queues are always current.

export async function getPendingDrafts(limit = 20) {
  return getDb()
    .select({
      id: aiDraft.id,
      fields: aiDraft.fields,
      sources: aiDraft.sources,
      aiModel: aiDraft.aiModel,
      promptVersion: aiDraft.promptVersion,
      createdAt: aiDraft.createdAt,
      animeTitle: anime.titleRomaji,
      animeSlug: anime.slug,
    })
    .from(aiDraft)
    .innerJoin(anime, eq(aiDraft.animeId, anime.id))
    .where(eq(aiDraft.status, "draft"))
    .orderBy(desc(aiDraft.createdAt))
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

