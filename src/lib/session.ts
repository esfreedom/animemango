import { eq } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { users } from "@/db/schema";
import { createSupabaseServerClient, isAuthConfigured } from "./supabase/server";

export type CurrentUser = typeof users.$inferSelect;

// Returns the signed-in user's row, creating it on first sign-in. Returns null when
// auth is not configured or nobody is signed in.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isAuthConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.id, data.user.id)).limit(1);
  if (existing) return existing;

  const username = await uniqueUsername(db, data.user.email ?? data.user.id);
  const [created] = await db
    .insert(users)
    .values({ id: data.user.id, username })
    .onConflictDoNothing()
    .returning();

  return created ?? (await db.select().from(users).where(eq(users.id, data.user.id)).limit(1))[0];
}

export function canModerate(user: CurrentUser | null): boolean {
  return user?.role === "moderator" || user?.role === "admin";
}

export function isAdmin(user: CurrentUser | null): boolean {
  return user?.role === "admin";
}

// Public usernames never show the email. The local part is cleaned up and a random
// suffix avoids collisions.
async function uniqueUsername(db: Db, seed: string): Promise<string> {
  const base =
    seed
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) || "fan";

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}${Math.random().toString(36).slice(2, 6)}`;
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, candidate)).limit(1);
    if (!taken) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}
