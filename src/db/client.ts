import { cache } from "react";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let cached: Db | undefined;

function createDb(url: string): Db {
  // `prepare: false` keeps the client compatible with Supabase's transaction pooler,
  // which does not support prepared statements.
  return drizzle(postgres(url, { max: Number(process.env.DATABASE_POOL_MAX ?? 5), prepare: false }), { schema });
}

// Cloudflare Workers do not let a socket opened in one request be used by another request.
// There, the client is made once per request (React cache) instead of once per process.
const requestDb = cache((url: string) => createDb(url));

function runsOnWorkers(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

// One pool per server process on Node. One client per request on Workers.
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }

  if (runsOnWorkers()) return requestDb(url);

  if (cached) return cached;
  cached = createDb(url);
  return cached;
}
