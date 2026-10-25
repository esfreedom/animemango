import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { animeFollow, notification } from "@/db/schema";

type NotifyInput = {
  animeId: string;
  kind: "episode_schedule" | "availability";
  title: string;
  body: string;
  href: string;
};

// Writes one notification per follower of the title. Returns how many were written.
export async function notifyFollowers(db: Db, input: NotifyInput): Promise<number> {
  const followers = await db
    .select({ userId: animeFollow.userId })
    .from(animeFollow)
    .where(eq(animeFollow.animeId, input.animeId));

  if (followers.length === 0) return 0;

  await db.insert(notification).values(
    followers.map((follower) => ({
      userId: follower.userId,
      kind: input.kind,
      animeId: input.animeId,
      title: input.title,
      body: input.body,
      href: input.href,
    })),
  );
  return followers.length;
}
