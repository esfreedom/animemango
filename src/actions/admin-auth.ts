"use server";

import { createHash } from "node:crypto";
import { and, count, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { adminCredential, adminLoginAttempt, auditLog, users } from "@/db/schema";
import {
  isLoginBlocked,
  isPasswordLoginEnabled,
  LOGIN_WINDOW_MS,
  verifyPassword,
} from "@/lib/admin-password";
import { ADMIN_USERNAME, SESSION_COOKIE, SESSION_TTL_MS, signSession } from "@/lib/admin-session";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";
import { formString } from "./shared";

const MIN_SECRET_LENGTH = 32;

// Back-office sign-in with a username and password (development only, see isPasswordLoginEnabled).
// The pages live on the admin host, so every redirect here is relative to that host.
// Failures are counted per address hash, and too many in the window blocks further attempts.
export async function loginAdmin(formData: FormData) {
  if (!isPasswordLoginEnabled()) redirect("/login?error=disabled");

  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) redirect("/login?error=not_configured");

  const db = getDb();
  const now = new Date();
  const ipHash = await addressHash(secret);
  const [{ failures }] = await db
    .select({ failures: count() })
    .from(adminLoginAttempt)
    .where(and(eq(adminLoginAttempt.ipHash, ipHash), gt(adminLoginAttempt.attemptedAt, new Date(now.getTime() - LOGIN_WINDOW_MS))));
  if (isLoginBlocked(Number(failures))) redirect("/login?error=too_many");

  const username = formString(formData, "username") ?? "";
  const password = String(formData.get("password") ?? "");
  const [credential] = username
    ? await db.select().from(adminCredential).where(eq(adminCredential.username, username)).limit(1)
    : [];
  const valid = credential ? await verifyPassword(password, credential.passwordHash) : false;

  if (!credential || !valid || username !== ADMIN_USERNAME) {
    await db.insert(adminLoginAttempt).values({ ipHash, attemptedAt: now });
    redirect("/login?error=invalid");
  }

  const token = signSession({ username: ADMIN_USERNAME, issuedAt: now.getTime() }, secret);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  const [account] = await db.select({ id: users.id }).from(users).where(eq(users.username, ADMIN_USERNAME)).limit(1);
  await db.delete(adminLoginAttempt).where(eq(adminLoginAttempt.ipHash, ipHash));
  if (account) {
    await db.insert(auditLog).values({ actorUserId: account.id, action: "admin.login", target: `user:${account.id}` });
  }

  redirect("/");
}

// Ends both the back-office session and a Google session on this host, if there is one.
export async function logoutAdmin() {
  if (isAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

// Hashes the caller's address with the session secret, so the database never holds a raw IP.
async function addressHash(secret: string): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || requestHeaders.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${secret}:${address}`).digest("hex");
}
