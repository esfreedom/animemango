"use server";

import { and, eq, isNull } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { animeFollow, animeVote, notification, takedownRequest } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "./shared";
import { formString } from "./shared";

const animeIdSchema = z.uuid();

export async function toggleVote(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("sign_in_required");

  const animeId = animeIdSchema.safeParse(formString(formData, "animeId"));
  if (!animeId.success) throw new Error("invalid_anime");

  const db = getDb();
  const [existing] = await db
    .select({ animeId: animeVote.animeId })
    .from(animeVote)
    .where(and(eq(animeVote.animeId, animeId.data), eq(animeVote.userId, user.id)))
    .limit(1);

  if (existing) {
    await db
      .delete(animeVote)
      .where(and(eq(animeVote.animeId, animeId.data), eq(animeVote.userId, user.id)));
  } else {
    await db.insert(animeVote).values({ animeId: animeId.data, userId: user.id });
  }

  // Season lists sort by votes, so every anime-level cache is refreshed.
  updateTag("anime");
}

export async function toggleFollow(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("sign_in_required");

  const animeId = animeIdSchema.safeParse(formString(formData, "animeId"));
  if (!animeId.success) throw new Error("invalid_anime");

  const db = getDb();
  const [existing] = await db
    .select({ animeId: animeFollow.animeId })
    .from(animeFollow)
    .where(and(eq(animeFollow.animeId, animeId.data), eq(animeFollow.userId, user.id)))
    .limit(1);

  if (existing) {
    await db
      .delete(animeFollow)
      .where(and(eq(animeFollow.animeId, animeId.data), eq(animeFollow.userId, user.id)));
  } else {
    await db.insert(animeFollow).values({ animeId: animeId.data, userId: user.id });
  }

}

export async function markNotificationsRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("sign_in_required");

  await getDb()
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, user.id), isNull(notification.readAt)));

}

const takedownSchema = z.object({
  requesterName: z.string().trim().min(2).max(120),
  requesterEmail: z.email().max(200),
  url: z.url().max(2000),
  reason: z.string().trim().min(10).max(2000),
});

// Public notice-and-takedown form (DESIGN.md section 13). Anyone can submit.
export async function submitTakedown(formData: FormData): Promise<ActionResult> {
  const parsed = takedownSchema.safeParse({
    requesterName: formData.get("requesterName") ?? "",
    requesterEmail: formData.get("requesterEmail") ?? "",
    url: formData.get("url") ?? "",
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "invalid_form" };

  await getDb().insert(takedownRequest).values(parsed.data);
  return { ok: true };
}
