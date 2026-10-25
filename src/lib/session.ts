import type { User as AuthUser } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { users } from "@/db/schema";
import { createSupabaseServerClient, isAuthConfigured } from "./supabase/server";

export type CurrentUser = typeof users.$inferSelect;

// Returns the signed-in user's row. Returns null when auth is not configured or nobody
// is signed in. The row is created on first sign-in and refreshed from the Google profile.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isAuthConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  return syncUserRecord(getDb(), data.user);
}

// Creates the users row for a Google account, or updates the display name and avatar
// when they changed. The username is chosen once and never changes here.
export async function syncUserRecord(db: Db, authUser: AuthUser): Promise<CurrentUser> {
  const profile = profileFromAuthUser(authUser);

  const [existing] = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1);
  if (existing) {
    if (existing.displayName === profile.displayName && existing.avatarUrl === profile.avatarUrl) {
      return existing;
    }
    const [updated] = await db
      .update(users)
      .set({ displayName: profile.displayName, avatarUrl: profile.avatarUrl })
      .where(eq(users.id, authUser.id))
      .returning();
    return updated;
  }

  const username = await uniqueUsername(db, profile.usernameSeed);
  const [created] = await db
    .insert(users)
    .values({
      id: authUser.id,
      username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  // Another request created the row first. Read it back.
  const [row] = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1);
  return row;
}

export function canModerate(user: CurrentUser | null): boolean {
  return user?.role === "moderator" || user?.role === "admin";
}

export function isAdmin(user: CurrentUser | null): boolean {
  return user?.role === "admin";
}

// Google supplies `full_name` and `picture` in user_metadata. Only https images are kept.
export function profileFromAuthUser(authUser: AuthUser) {
  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;

  const rawName = [meta.full_name, meta.name].find((value) => typeof value === "string");
  const displayName = typeof rawName === "string" && rawName.trim() ? rawName.trim().slice(0, 80) : null;

  const rawAvatar = [meta.avatar_url, meta.picture].find((value) => typeof value === "string");
  const avatarUrl = typeof rawAvatar === "string" && rawAvatar.startsWith("https://") ? rawAvatar : null;

  return {
    displayName,
    avatarUrl,
    usernameSeed: authUser.email ?? displayName ?? authUser.id,
  };
}

// Public usernames never show the email. The local part is cleaned up and a random
// suffix avoids collisions.
async function uniqueUsername(db: Db, seed: string): Promise<string> {
  const cleaned = seed
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  const base = cleaned.length >= 3 ? cleaned : "user";

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}${Math.random().toString(36).slice(2, 6)}`;
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, candidate)).limit(1);
    if (!taken) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
}
