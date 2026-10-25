import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  anime,
  animeI18n,
  announcement,
  availabilityLog,
  platform,
  platformAvailability,
  proposal,
} from "@/db/schema";
import { notifyFollowers } from "@/lib/notify";
import { availabilityPayload, announcementPayload, structurePayload } from "./proposals";
import type { ProposalKind } from "./policy";

export type ProposalRow = typeof proposal.$inferSelect;

export type MetadataEdits = { titleTh?: string | null; synopsisTh?: string | null };

// Applies an approved proposal. Called only from an admin action, after the reviewer has
// accepted the text. Writes go to the public tables here and nowhere else.
export async function applyProposal(
  db: Db,
  row: ProposalRow,
  reviewerId: string,
  edits: MetadataEdits = {},
): Promise<void> {
  const kind = row.kind as ProposalKind;

  if (kind === "metadata") {
    await applyMetadata(db, row, reviewerId, edits);
  } else if (kind === "availability") {
    await applyAvailability(db, row, reviewerId);
  } else if (kind === "announcement") {
    await applyAnnouncement(db, row);
  } else {
    await applyStructure(db, row);
  }

  await db
    .update(proposal)
    .set({ status: "applied", reviewedBy: reviewerId, reviewedAt: new Date() })
    .where(eq(proposal.id, row.id));
}

async function applyMetadata(db: Db, row: ProposalRow, reviewerId: string, edits: MetadataEdits) {
  if (!row.animeId) throw new Error("proposal_has_no_title");
  const original = row.payload as { titleTh?: string | null; synopsisTh?: string | null };
  const titleTh = edits.titleTh ?? original.titleTh ?? null;
  const synopsisTh = edits.synopsisTh ?? original.synopsisTh ?? null;
  if (!titleTh) throw new Error("title_required");

  // Text the reviewer changed is marked "human". Text published as drafted stays "machine".
  const edited = titleTh !== (original.titleTh ?? null) || synopsisTh !== (original.synopsisTh ?? null);
  const source = edited ? "human" : "machine";

  await db
    .insert(animeI18n)
    .values({ animeId: row.animeId, locale: "th", title: titleTh, synopsis: synopsisTh, source, reviewedBy: reviewerId })
    .onConflictDoUpdate({
      target: [animeI18n.animeId, animeI18n.locale],
      set: { title: titleTh, synopsis: synopsisTh, source, reviewedBy: reviewerId },
    });
}

async function applyAvailability(db: Db, row: ProposalRow, reviewerId: string) {
  if (!row.animeId) throw new Error("proposal_has_no_title");
  const parsed = availabilityPayload.parse(row.payload);

  const [site] = await db.select({ id: platform.id, name: platform.name }).from(platform).where(eq(platform.name, parsed.platformName)).limit(1);
  if (!site) throw new Error("unknown_platform");

  const now = new Date();
  await db.insert(platformAvailability).values({
    animeId: row.animeId,
    platformId: site.id,
    region: parsed.region.toUpperCase(),
    audioLangs: parsed.audioLangs,
    subLangs: parsed.subLangs,
    availableFrom: now,
    coversAllEpisodes: parsed.coversAllEpisodes,
    episodeFrom: parsed.episodeFrom,
    episodeTo: parsed.episodeTo,
    sourceUrl: parsed.sourceUrl,
    verifiedAt: now,
    verifiedBy: reviewerId,
  });

  await db.insert(availabilityLog).values({
    animeId: row.animeId,
    platformId: site.id,
    event: "added",
    audioLangs: parsed.audioLangs,
    subLangs: parsed.subLangs,
    sourceUrl: parsed.sourceUrl,
    occurredAt: now,
  });

  const [target] = await db.select({ slug: anime.slug, titleRomaji: anime.titleRomaji }).from(anime).where(eq(anime.id, row.animeId));
  if (target) {
    await notifyFollowers(db, {
      animeId: row.animeId,
      kind: "availability",
      title: `มีที่ดูใหม่: ${target.titleRomaji}`,
      body: `ตอนนี้ดูได้ที่ ${site.name}`,
      href: `/th/anime/${target.slug}`,
    });
  }
}

async function applyAnnouncement(db: Db, row: ProposalRow) {
  const parsed = announcementPayload.parse(row.payload);
  await db.insert(announcement).values({
    animeId: row.animeId,
    title: parsed.title,
    summary: parsed.summary ?? null,
    sourceName: parsed.sourceName,
    sourceUrl: parsed.sourceUrl,
    publishedAt: new Date(parsed.publishedAt),
  });
}

// Writes the series membership, kind and season label of each listed entry.
async function applyStructure(db: Db, row: ProposalRow) {
  const parsed = structurePayload.parse(row.payload);
  for (const entry of parsed.entries) {
    const [target] = await db.select({ id: anime.id }).from(anime).where(eq(anime.slug, entry.animeSlug)).limit(1);
    if (!target) throw new Error(`unknown_anime: ${entry.animeSlug}`);

    await db
      .update(anime)
      .set({
        ...(row.seriesId ? { seriesId: row.seriesId } : {}),
        entryKind: entry.entryKind,
        seasonLabel: entry.seasonLabel,
        sortOrder: entry.sortOrder,
      })
      .where(eq(anime.id, target.id));
  }
}
