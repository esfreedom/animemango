"use server";

import { and, eq, isNull } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  anime,
  animeI18n,
  announcement,
  proposal,
  availabilityLog,
  studioChannel,
  platform,
  platformAvailability,
  takedownRequest,
  trailer,
  watchOrderEntry,
} from "@/db/schema";
import { notifyFollowers } from "@/lib/notify";
import { allowedHostsFrom } from "@/ai/policy";
import { applyProposal } from "@/ai/apply";
import { canEmbedTrailer, isYoutubeVideoId } from "@/lib/trailer";
import { validateOfficialTitle } from "@/ai/official-title";
import { isAdmin, getCurrentUser } from "@/lib/session";
import { formString } from "./shared";

// Every action here is admin-only. Editors act through the admin page, and the
// database rules are enforced in these actions, not in the UI.
async function requireAdmin() {
  const user = await getCurrentUser();
  return isAdmin(user) ? user : null;
}


const langList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

async function animeBySlug(slug: string | undefined) {
  if (!slug) return null;
  const [row] = await getDb()
    .select({ id: anime.id, slug: anime.slug, titleRomaji: anime.titleRomaji })
    .from(anime)
    .where(eq(anime.slug, slug))
    .limit(1);
  return row ?? null;
}

// ---- Proposal queue (DESIGN.md section 8, approved series plan section 6) -----

export async function approveProposal(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const proposalId = z.uuid().safeParse(formString(formData, "proposalId"));
  if (!proposalId.success) throw new Error("invalid_proposal");

  const db = getDb();
  const [row] = await db.select().from(proposal).where(eq(proposal.id, proposalId.data)).limit(1);
  if (!row || row.status !== "pending") throw new Error("proposal_not_pending");

  await applyProposal(db, row, user.id, {
    titleTh: formString(formData, "titleTh"),
    synopsisTh: formString(formData, "synopsisTh"),
  });

  updateTag("anime");
}

// Saves the official Thai name of a title. The source must be a checkable official page, and AniList
// is refused. The admin who saves it is recorded as the reviewer.
export async function setOfficialTitle(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const target = await animeBySlug(formString(formData, "animeSlug"));
  if (!target) throw new Error("anime_not_found");

  const db = getDb();
  const platforms = await db.select({ officialUrl: platform.officialUrl }).from(platform);
  const allowedHosts = allowedHostsFrom(platforms.map((item) => item.officialUrl), process.env.OFFICIAL_SOURCE_HOSTS);

  const checked = validateOfficialTitle(
    { titleTh: formString(formData, "titleTh") ?? "", sourceUrl: formString(formData, "sourceUrl") ?? "" },
    allowedHosts,
  );
  if (!checked.ok) throw new Error(checked.errors.join(","));

  await db
    .insert(animeI18n)
    .values({
      animeId: target.id,
      locale: "th",
      title: checked.titleTh,
      source: "official",
      sourceUrl: formString(formData, "sourceUrl") ?? null,
      reviewedBy: user.id,
    })
    .onConflictDoUpdate({
      target: [animeI18n.animeId, animeI18n.locale],
      set: {
        title: checked.titleTh,
        source: "official",
        sourceUrl: formString(formData, "sourceUrl") ?? null,
        reviewedBy: user.id,
      },
    });

  updateTag(`anime:${target.slug}`);
  updateTag("anime");
}

export async function rejectProposal(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const proposalId = z.uuid().safeParse(formString(formData, "proposalId"));
  if (!proposalId.success) throw new Error("invalid_proposal");

  await getDb()
    .update(proposal)
    .set({ status: "rejected", reviewedBy: user.id, reviewedAt: new Date() })
    .where(and(eq(proposal.id, proposalId.data), eq(proposal.status, "pending")));
}

// ---- Availability (DESIGN.md section 7) -----------------------------------

const availabilitySchema = z.object({
  animeSlug: z.string().min(1),
  platformId: z.coerce.number().int().positive(),
  region: z.string().trim().min(2).max(5),
  sourceUrl: z.url(),
});

export async function addAvailability(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const parsed = availabilitySchema.safeParse({
    animeSlug: formString(formData, "animeSlug"),
    platformId: formString(formData, "platformId"),
    region: formString(formData, "region") ?? "TH",
    sourceUrl: formString(formData, "sourceUrl"),
  });
  if (!parsed.success) throw new Error("invalid_form");

  const target = await animeBySlug(parsed.data.animeSlug);
  if (!target) throw new Error("anime_not_found");

  const audioLangs = langList(formString(formData, "audioLangs"));
  const subLangs = langList(formString(formData, "subLangs"));
  const now = new Date();
  const db = getDb();

  await db.insert(platformAvailability).values({
    animeId: target.id,
    platformId: parsed.data.platformId,
    region: parsed.data.region.toUpperCase(),
    audioLangs,
    subLangs,
    availableFrom: now,
    sourceUrl: parsed.data.sourceUrl,
    verifiedAt: now,
    verifiedBy: user.id,
  });

  await db.insert(availabilityLog).values({
    animeId: target.id,
    platformId: parsed.data.platformId,
    event: "added",
    audioLangs,
    subLangs,
    sourceUrl: parsed.data.sourceUrl,
    occurredAt: now,
  });

  const [site] = await db.select({ name: platform.name }).from(platform).where(eq(platform.id, parsed.data.platformId));
  await notifyFollowers(db, {
    animeId: target.id,
    kind: "availability",
    title: `มีที่ดูใหม่: ${target.titleRomaji}`,
    body: `ตอนนี้ดูได้ที่ ${site?.name ?? "แพลตฟอร์มทางการ"}`,
    href: `/th/anime/${target.slug}`,
  });

  updateTag("anime");
}

export async function endAvailability(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const id = z.coerce.number().int().positive().safeParse(formString(formData, "availabilityId"));
  if (!id.success) throw new Error("invalid_form");

  const db = getDb();
  const [row] = await db
    .select()
    .from(platformAvailability)
    .where(and(eq(platformAvailability.id, id.data), isNull(platformAvailability.availableTo)))
    .limit(1);
  if (!row) throw new Error("not_found");

  const now = new Date();
  await db
    .update(platformAvailability)
    .set({ availableTo: now, verifiedAt: now, verifiedBy: user.id })
    .where(eq(platformAvailability.id, row.id));

  await db.insert(availabilityLog).values({
    animeId: row.animeId,
    platformId: row.platformId,
    event: "removed",
    audioLangs: row.audioLangs,
    subLangs: row.subLangs,
    sourceUrl: row.sourceUrl,
    occurredAt: now,
  });

  const [target] = await db.select({ slug: anime.slug, titleRomaji: anime.titleRomaji }).from(anime).where(eq(anime.id, row.animeId));
  if (target) {
    await notifyFollowers(db, {
      animeId: row.animeId,
      kind: "availability",
      title: `สิทธิ์การดูเปลี่ยน: ${target.titleRomaji}`,
      body: `ตอนนี้ไม่มีให้ดูบางแพลตฟอร์มแล้ว ดูประวัติการฉายได้ในหน้าเรื่อง`,
      href: `/th/anime/${target.slug}`,
    });
  }

  updateTag("anime");
}



// Only channels added here can have their trailers embedded (DESIGN.md section 1).
export async function addTrailer(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const youtubeId = formString(formData, "youtubeId") ?? "";
  const channelId = formString(formData, "channelId") ?? "";
  if (!isYoutubeVideoId(youtubeId) || channelId.length < 3) {
    throw new Error("invalid_form");
  }

  const target = await animeBySlug(formString(formData, "animeSlug"));
  if (!target) throw new Error("anime_not_found");

  // The channel must already exist as a studio channel. Its status decides whether the trailer shows.
  const db = getDb();
  const [channel] = await db
    .select({ id: studioChannel.id, status: studioChannel.status, allowTrailer: studioChannel.allowTrailer })
    .from(studioChannel)
    .where(and(eq(studioChannel.platform, "youtube"), eq(studioChannel.channelId, channelId)))
    .limit(1);

  await db
    .insert(trailer)
    .values({
      animeId: target.id,
      youtubeId,
      channelId,
      channelVerified: canEmbedTrailer(channel ?? null),
      studioChannelId: channel?.id ?? null,
    })
    .onConflictDoUpdate({
      target: trailer.youtubeId,
      set: {
        animeId: target.id,
        channelId,
        channelVerified: canEmbedTrailer(channel ?? null),
        studioChannelId: channel?.id ?? null,
      },
    });

  updateTag(`anime:${target.slug}`);
}

// ---- Announcements, watch order and platforms -----------------------------

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().max(500).optional(),
  sourceName: z.string().trim().min(2).max(120),
  sourceUrl: z.url(),
  publishedAt: z.coerce.date(),
});

export async function addAnnouncement(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const parsed = announcementSchema.safeParse({
    title: formString(formData, "title"),
    summary: formString(formData, "summary"),
    sourceName: formString(formData, "sourceName"),
    sourceUrl: formString(formData, "sourceUrl"),
    publishedAt: formString(formData, "publishedAt"),
  });
  if (!parsed.success) throw new Error("invalid_form");

  const target = await animeBySlug(formString(formData, "animeSlug"));
  await getDb().insert(announcement).values({ ...parsed.data, animeId: target?.id ?? null });

  updateTag("anime");
}

const watchOrderSchema = z.object({
  position: z.coerce.number().int().min(1).max(500),
  relation: z.string().trim().min(2).max(40),
  note: z.string().trim().max(300).optional(),
});

export async function addWatchOrderEntry(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const parsed = watchOrderSchema.safeParse({
    position: formString(formData, "position"),
    relation: formString(formData, "relation"),
    note: formString(formData, "note"),
  });
  if (!parsed.success) throw new Error("invalid_form");

  const [franchise, related] = await Promise.all([
    animeBySlug(formString(formData, "animeSlug")),
    animeBySlug(formString(formData, "relatedSlug")),
  ]);
  if (!franchise || !related) throw new Error("anime_not_found");

  await getDb().insert(watchOrderEntry).values({
    animeId: franchise.id,
    relatedAnimeId: related.id,
    position: parsed.data.position,
    relation: parsed.data.relation,
    isSpoiler: formData.get("isSpoiler") === "on",
    note: parsed.data.note,
  });

  updateTag(`watch-order:${franchise.id}`);
}

export async function addPlatform(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const name = formString(formData, "name");
  const officialUrl = formString(formData, "officialUrl");
  if (!name || !z.url().safeParse(officialUrl).success) throw new Error("invalid_form");

  await getDb().insert(platform).values({
    name,
    officialUrl: officialUrl!,
    regions: langList(formString(formData, "regions")).map((region) => region.toUpperCase()),
  });

  updateTag("platforms");
}

export async function setTakedownStatus(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const id = z.uuid().safeParse(formString(formData, "id"));
  const status = formString(formData, "status");
  if (!id.success || (status !== "open" && status !== "actioned" && status !== "rejected")) {
    throw new Error("invalid_form");
  }

  await getDb().update(takedownRequest).set({ status }).where(eq(takedownRequest.id, id.data));
}
