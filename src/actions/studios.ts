"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { anime, animeStudio, auditLog, platform, studio, studioChannel, trailer } from "@/db/schema";
import { allowedHostsFrom } from "@/ai/policy";
import { isOfficialTitleSource } from "@/ai/official-title";
import { isAdmin, getCurrentUser } from "@/lib/session";
import { formString } from "./shared";

// Only admins manage studios and approve channels. Each approval or revocation is audited.
async function requireAdmin() {
  const user = await getCurrentUser();
  return isAdmin(user) ? user : null;
}

// Hosts that may be cited as official: platform sites, studio websites, and the env list.
async function allowedHosts(): Promise<string[]> {
  const db = getDb();
  const [platforms, studios] = await Promise.all([
    db.select({ url: platform.officialUrl }).from(platform),
    db.select({ url: studio.websiteUrl }).from(studio),
  ]);
  const urls = [...platforms.map((item) => item.url), ...studios.flatMap((item) => (item.url ? [item.url] : []))];
  return allowedHostsFrom(urls, process.env.OFFICIAL_SOURCE_HOSTS);
}

const studioSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,80}$/),
  nameRomaji: z.string().trim().min(2).max(120),
  kind: z.enum(["studio", "distributor", "platform", "rights_holder"]),
  websiteUrl: z.url().max(2000).nullable(),
});

export async function createStudio(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const parsed = studioSchema.safeParse({
    slug: formString(formData, "slug"),
    nameRomaji: formString(formData, "nameRomaji"),
    kind: formString(formData, "kind") ?? "studio",
    websiteUrl: formString(formData, "websiteUrl") ?? null,
  });
  if (!parsed.success) throw new Error("invalid_form");

  const db = getDb();
  const [created] = await db.insert(studio).values(parsed.data).returning({ id: studio.id });
  await db.insert(auditLog).values({
    actorUserId: user.id,
    action: "studio.create",
    target: `studio:${created.id}`,
    detail: { slug: parsed.data.slug },
  });

  updateTag("studios");
}

const channelSchema = z.object({
  platform: z.enum(["youtube", "facebook", "x", "website"]),
  channelId: z.string().trim().min(3).max(120),
  url: z.url().max(2000),
  evidenceUrl: z.url().max(2000),
});

// A new channel starts as pending. Nothing from it can be embedded until an admin approves it.
export async function addStudioChannel(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const studioSlug = formString(formData, "studioSlug") ?? "";
  const parsed = channelSchema.safeParse({
    platform: formString(formData, "platform") ?? "youtube",
    channelId: formString(formData, "channelId"),
    url: formString(formData, "url"),
    evidenceUrl: formString(formData, "evidenceUrl"),
  });
  if (!parsed.success) throw new Error("invalid_form");

  const hosts = await allowedHosts();
  if (!isOfficialTitleSource(parsed.data.url, hosts) || !isOfficialTitleSource(parsed.data.evidenceUrl, hosts)) {
    throw new Error("source_not_official");
  }

  const db = getDb();
  const [owner] = await db.select({ id: studio.id }).from(studio).where(eq(studio.slug, studioSlug)).limit(1);
  if (!owner) throw new Error("studio_not_found");

  const [created] = await db
    .insert(studioChannel)
    .values({ ...parsed.data, studioId: owner.id, status: "pending", allowTrailer: false })
    .returning({ id: studioChannel.id });
  await db.insert(auditLog).values({
    actorUserId: user.id,
    action: "channel.add",
    target: `channel:${created.id}`,
    detail: { platform: parsed.data.platform, channelId: parsed.data.channelId },
  });

  updateTag("studios");
}

// Approves or revokes a channel. Approval turns on trailer embeds for it. Revoking removes them.
export async function setChannelApproval(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const id = z.coerce.number().int().positive().safeParse(formString(formData, "channelId"));
  const decision = formString(formData, "decision");
  if (!id.success || (decision !== "approve" && decision !== "revoke")) throw new Error("invalid_form");

  const db = getDb();
  const [channel] = await db.select().from(studioChannel).where(eq(studioChannel.id, id.data)).limit(1);
  if (!channel) throw new Error("channel_not_found");

  const now = new Date();
  const approve = decision === "approve";
  await db
    .update(studioChannel)
    .set(
      approve
        ? { status: "approved", allowTrailer: true, approvedBy: user.id, approvedAt: now, revokedAt: null }
        : { status: "revoked", allowTrailer: false, revokedAt: now },
    )
    .where(eq(studioChannel.id, channel.id));

  // Keeps the trailer flags in step with the channel status (see lib/trailer.ts).
  await db
    .update(trailer)
    .set({ channelVerified: approve })
    .where(eq(trailer.studioChannelId, channel.id));

  await db.insert(auditLog).values({
    actorUserId: user.id,
    action: approve ? "channel.approve" : "channel.revoke",
    target: `channel:${channel.id}`,
    detail: { platform: channel.platform, channelId: channel.channelId },
  });

  updateTag("anime");
  updateTag("studios");
}

export async function linkStudioAnime(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const studioSlug = formString(formData, "studioSlug") ?? "";
  const animeSlug = formString(formData, "animeSlug") ?? "";
  const role = formString(formData, "role");
  if (role !== "produce" && role !== "distribute" && role !== "licensor") throw new Error("invalid_form");

  const db = getDb();
  const [owner] = await db.select({ id: studio.id }).from(studio).where(eq(studio.slug, studioSlug)).limit(1);
  const [title] = await db.select({ id: anime.id }).from(anime).where(eq(anime.slug, animeSlug)).limit(1);
  if (!owner || !title) throw new Error("not_found");

  await db
    .insert(animeStudio)
    .values({ animeId: title.id, studioId: owner.id, role })
    .onConflictDoNothing();

  updateTag("studios");
  updateTag(`anime:${animeSlug}`);
}

export async function deleteStudioLink(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  if (!user) throw new Error("forbidden");

  const studioSlug = formString(formData, "studioSlug") ?? "";
  const animeSlug = formString(formData, "animeSlug") ?? "";
  const role = z.enum(["produce", "distribute", "licensor"]).safeParse(formString(formData, "role"));
  const db = getDb();
  const [owner] = await db.select({ id: studio.id }).from(studio).where(eq(studio.slug, studioSlug)).limit(1);
  const [title] = await db.select({ id: anime.id }).from(anime).where(eq(anime.slug, animeSlug)).limit(1);
  if (!owner || !title || !role.success) throw new Error("not_found");

  await db
    .delete(animeStudio)
    .where(and(eq(animeStudio.animeId, title.id), eq(animeStudio.studioId, owner.id), eq(animeStudio.role, role.data)));

  updateTag("studios");
  updateTag(`anime:${animeSlug}`);
}
