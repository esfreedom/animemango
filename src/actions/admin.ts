"use server";

import { and, eq, isNull } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  anime,
  animeI18n,
  announcement,
  aiDraft,
  availabilityLog,
  officialChannel,
  platform,
  platformAvailability,
  takedownRequest,
  trailer,
  watchOrderEntry,
} from "@/db/schema";
import { notifyFollowers } from "@/lib/notify";
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

// ---- AI drafts (DESIGN.md section 8) --------------------------------------

export async function approveDraft(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const draftId = z.uuid().safeParse(formString(formData, "draftId"));
  if (!draftId.success) throw new Error("invalid_draft");

  const db = getDb();
  const [draft] = await db.select().from(aiDraft).where(eq(aiDraft.id, draftId.data)).limit(1);
  if (!draft || draft.status !== "draft") throw new Error("draft_not_pending");

  const original = draft.fields as { titleTh?: string | null; synopsisTh?: string | null };
  const titleTh = formString(formData, "titleTh") ?? original.titleTh ?? null;
  const synopsisTh = formString(formData, "synopsisTh") ?? original.synopsisTh ?? null;

  // Edited text is marked "human". Text published as drafted stays "machine".
  const edited =
    titleTh !== (original.titleTh ?? null) || synopsisTh !== (original.synopsisTh ?? null);

  if (titleTh) {
    await db
      .insert(animeI18n)
      .values({
        animeId: draft.animeId,
        locale: "th",
        title: titleTh,
        synopsis: synopsisTh,
        source: edited ? "human" : "machine",
        reviewedBy: user.id,
      })
      .onConflictDoUpdate({
        target: [animeI18n.animeId, animeI18n.locale],
        set: {
          title: titleTh,
          synopsis: synopsisTh,
          source: edited ? "human" : "machine",
          reviewedBy: user.id,
        },
      });
  }

  await db
    .update(aiDraft)
    .set({ status: "published", reviewedBy: user.id, reviewedAt: new Date() })
    .where(eq(aiDraft.id, draft.id));

  updateTag("anime");
}

export async function rejectDraft(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const draftId = z.uuid().safeParse(formString(formData, "draftId"));
  if (!draftId.success) throw new Error("invalid_draft");

  await getDb()
    .update(aiDraft)
    .set({ status: "rejected", reviewedBy: user.id, reviewedAt: new Date() })
    .where(and(eq(aiDraft.id, draftId.data), eq(aiDraft.status, "draft")));

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

const channelSchema = z.object({
  channelId: z.string().trim().min(3).max(64),
  name: z.string().trim().min(1).max(120),
  evidenceUrl: z.url(),
});

// Only channels added here can have their trailers embedded (DESIGN.md section 1).
export async function addOfficialChannel(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const parsed = channelSchema.safeParse({
    channelId: formString(formData, "channelId"),
    name: formString(formData, "name"),
    evidenceUrl: formString(formData, "evidenceUrl"),
  });
  if (!parsed.success) throw new Error("invalid_form");

  await getDb()
    .insert(officialChannel)
    .values({ ...parsed.data, verifiedBy: user.id })
    .onConflictDoUpdate({
      target: officialChannel.channelId,
      set: { name: parsed.data.name, evidenceUrl: parsed.data.evidenceUrl, verifiedBy: user.id, verifiedAt: new Date() },
    });

  updateTag("anime");
}

export async function addTrailer(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const youtubeId = formString(formData, "youtubeId") ?? "";
  const channelId = formString(formData, "channelId") ?? "";
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(youtubeId) || channelId.length < 3) {
    throw new Error("invalid_form");
  }

  const target = await animeBySlug(formString(formData, "animeSlug"));
  if (!target) throw new Error("anime_not_found");

  const db = getDb();
  const [channel] = await db
    .select({ channelId: officialChannel.channelId })
    .from(officialChannel)
    .where(eq(officialChannel.channelId, channelId))
    .limit(1);

  await db
    .insert(trailer)
    .values({
      animeId: target.id,
      youtubeId,
      channelId,
      channelVerified: Boolean(channel),
    })
    .onConflictDoUpdate({
      target: trailer.youtubeId,
      set: { animeId: target.id, channelId, channelVerified: Boolean(channel) },
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
