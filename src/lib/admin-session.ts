import { createHmac, timingSafeEqual } from "node:crypto";

// Signed session for the back-office login. The token is "<base64url payload>.<hex HMAC>".
// It is stored in an httpOnly cookie, and it expires after 8 hours.

export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
// The one back-office account. Its users row and its admin_credential row share this username.
export const ADMIN_USERNAME = "admin";
const CLOCK_SKEW_MS = 60 * 1000;
const MIN_SECRET_LENGTH = 32;

export type AdminSession = { username: string; issuedAt: number };

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function assertSecret(secret: string | undefined): asserts secret is string {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`ADMIN_SESSION_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters long`);
  }
}

export function signSession(session: AdminSession, secret: string | undefined): string {
  assertSecret(secret);
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

// Returns the session when the signature is valid and the session is still within its lifetime.
export function verifySession(token: string | undefined, secret: string | undefined, now: number): AdminSession | null {
  if (!token || !secret || secret.length < MIN_SECRET_LENGTH) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "utf8");
  const wanted = Buffer.from(sign(body, secret), "utf8");
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;

  let session: AdminSession;
  try {
    session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AdminSession;
  } catch {
    return null;
  }
  if (typeof session.username !== "string" || typeof session.issuedAt !== "number") return null;
  if (session.issuedAt > now + CLOCK_SKEW_MS) return null;
  if (now - session.issuedAt > SESSION_TTL_MS) return null;
  return session;
}
