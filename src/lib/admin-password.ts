import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Password hashing for the back-office account (approved plan, section 5).
// Format: scrypt$N$r$p$salt$key, with base64 salt and key, so the parameters travel with the hash.

const PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: MAX_MEMORY }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, PARAMS.N, PARAMS.r, PARAMS.p);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((value) => Number.isInteger(value) && value > 0)) return false;

  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await deriveKey(password, salt, N, r, p);
  return timingSafeEqual(actual, expected);
}

// Password login is for development only. In production it stays off unless the operator sets
// ADMIN_PASSWORD_LOGIN=true explicitly.
export function isPasswordLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" || env.ADMIN_PASSWORD_LOGIN === "true";
}

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LIMIT = 5;

// True when this address has used up its attempts in the window.
export function isLoginBlocked(recentFailures: number): boolean {
  return recentFailures >= LOGIN_LIMIT;
}
