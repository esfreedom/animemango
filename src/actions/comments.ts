"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { comment, commentReport, thread } from "@/db/schema";
import { countCommentsSince } from "@/data/community";
import { detectLanguage, isCommentLang } from "@/lib/lang";
import { canModerate, getCurrentUser } from "@/lib/session";
import type { ActionResult } from "./shared";
import { formString } from "./shared";

const MAX_COMMENTS_PER_WINDOW = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const postSchema = z.object({
  threadId: z.uuid(),
  parentId: z.uuid().optional(),
  body: z.string().trim().min(1).max(2000),
});

export async function postComment(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "sign_in_required" };

  const parsed = postSchema.safeParse({
    threadId: formString(formData, "threadId"),
    parentId: formString(formData, "parentId"),
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "invalid_body" };

  const { threadId, parentId, body } = parsed.data;
  const db = getDb();

  const recent = await countCommentsSince(user.id, new Date(Date.now() - RATE_WINDOW_MS));
  if (recent >= MAX_COMMENTS_PER_WINDOW) return { ok: false, error: "rate_limited" };

  const [target] = await db.select().from(thread).where(eq(thread.id, threadId)).limit(1);
  if (!target) return { ok: false, error: "thread_not_found" };
  if (target.locked) return { ok: false, error: "thread_locked" };

  if (parentId) {
    const [parent] = await db
      .select({ id: comment.id })
      .from(comment)
      .where(and(eq(comment.id, parentId), eq(comment.threadId, threadId), eq(comment.status, "visible")))
      .limit(1);
    if (!parent) return { ok: false, error: "parent_not_found" };
  }

  // The reader can set the language tag. Otherwise the tag comes from detection.
  const chosen = formString(formData, "lang");
  const userChose = isCommentLang(chosen);
  const lang = userChose ? chosen : detectLanguage(body);

  await db.insert(comment).values({
    threadId,
    userId: user.id,
    parentId: parentId ?? null,
    body,
    lang,
    langSource: userChose ? "user" : "detected",
  });

  updateTag(`thread:${threadId}`);
  updateTag("threads");
  return { ok: true };
}

const reportSchema = z.object({
  commentId: z.uuid(),
  reason: z.string().trim().min(3).max(300),
});

export async function reportComment(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "sign_in_required" };

  const parsed = reportSchema.safeParse({
    commentId: formString(formData, "commentId"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "invalid_reason" };

  await getDb()
    .insert(commentReport)
    .values({ commentId: parsed.data.commentId, userId: user.id, reason: parsed.data.reason })
    .onConflictDoNothing();

  return { ok: true };
}

export async function setCommentStatus(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!canModerate(user)) throw new Error("forbidden");

  const commentId = formString(formData, "commentId");
  const status = formString(formData, "status");
  if (!z.uuid().safeParse(commentId).success) throw new Error("invalid_comment");
  if (status !== "visible" && status !== "hidden" && status !== "removed") {
    throw new Error("invalid_status");
  }

  const db = getDb();
  const [row] = await db
    .select({ threadId: comment.threadId })
    .from(comment)
    .where(eq(comment.id, commentId!))
    .limit(1);
  if (!row) throw new Error("comment_not_found");

  await db.update(comment).set({ status }).where(eq(comment.id, commentId!));
  updateTag(`thread:${row.threadId}`);
}
