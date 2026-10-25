import { and, count, desc, eq, isNull, gte } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db/client";
import {
  anime,
  animeFollow,
  animeVote,
  comment,
  commentReport,
  notification,
  users,
} from "@/db/schema";
import type { CommentLang } from "@/lib/lang";

// Threads and comments are public, so they are cached and tagged per thread.
// Postings call updateTag("thread:<id>"). Per-user state is read on every request.

export async function getThreadComments(threadId: string, lang?: CommentLang) {
  "use cache";
  cacheTag(`thread:${threadId}`);
  cacheLife("minutes");

  const db = getDb();
  const conditions = [eq(comment.threadId, threadId), eq(comment.status, "visible")];
  if (lang) conditions.push(eq(comment.lang, lang));

  return db
    .select({
      id: comment.id,
      parentId: comment.parentId,
      body: comment.body,
      lang: comment.lang,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
      username: users.username,
    })
    .from(comment)
    .innerJoin(users, eq(comment.userId, users.id))
    .where(and(...conditions))
    .orderBy(comment.createdAt)
    .limit(300);
}

export async function getThreadLanguageCounts(threadId: string) {
  "use cache";
  cacheTag(`thread:${threadId}`);
  cacheLife("minutes");

  const rows = await getDb()
    .select({ lang: comment.lang, total: count() })
    .from(comment)
    .where(and(eq(comment.threadId, threadId), eq(comment.status, "visible")))
    .groupBy(comment.lang);

  return Object.fromEntries(rows.map((row) => [row.lang, Number(row.total)]));
}

// Votes and follows for one viewer. Not cached, because they depend on who is asking.
export async function getAnimeVoteState(animeId: string, userId: string | null) {
  const db = getDb();
  const [{ total }] = await db
    .select({ total: count() })
    .from(animeVote)
    .where(eq(animeVote.animeId, animeId));

  let voted = false;
  let following = false;
  if (userId) {
    const [vote] = await db
      .select({ animeId: animeVote.animeId })
      .from(animeVote)
      .where(and(eq(animeVote.animeId, animeId), eq(animeVote.userId, userId)))
      .limit(1);
    const [follow] = await db
      .select({ animeId: animeFollow.animeId })
      .from(animeFollow)
      .where(and(eq(animeFollow.animeId, animeId), eq(animeFollow.userId, userId)))
      .limit(1);
    voted = Boolean(vote);
    following = Boolean(follow);
  }

  return { votes: Number(total), voted, following };
}

export async function listNotifications(userId: string, limit = 50) {
  return getDb()
    .select()
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const [{ total }] = await getDb()
    .select({ total: count() })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return Number(total);
}

export async function getProfile(username: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) return null;

  const [comments, follows] = await Promise.all([
    db
      .select({
        id: comment.id,
        body: comment.body,
        lang: comment.lang,
        createdAt: comment.createdAt,
        threadId: comment.threadId,
      })
      .from(comment)
      .where(and(eq(comment.userId, user.id), eq(comment.status, "visible")))
      .orderBy(desc(comment.createdAt))
      .limit(20),
    db
      .select({ slug: anime.slug, titleRomaji: anime.titleRomaji })
      .from(animeFollow)
      .innerJoin(anime, eq(animeFollow.animeId, anime.id))
      .where(eq(animeFollow.userId, user.id))
      .limit(50),
  ]);

  return { user, comments, follows };
}

export async function getFollowerCount(animeId: string) {
  const [{ total }] = await getDb()
    .select({ total: count() })
    .from(animeFollow)
    .where(eq(animeFollow.animeId, animeId));
  return Number(total);
}

export async function getRecentReports(limit = 50) {
  return getDb()
    .select({
      id: commentReport.id,
      reason: commentReport.reason,
      createdAt: commentReport.createdAt,
      commentId: comment.id,
      body: comment.body,
      status: comment.status,
    })
    .from(commentReport)
    .innerJoin(comment, eq(commentReport.commentId, comment.id))
    .orderBy(desc(commentReport.createdAt))
    .limit(limit);
}

export async function countCommentsSince(userId: string, since: Date): Promise<number> {
  const [{ total }] = await getDb()
    .select({ total: count() })
    .from(comment)
    .where(and(eq(comment.userId, userId), gte(comment.createdAt, since)));
  return Number(total);
}
