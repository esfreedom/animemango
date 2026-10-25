import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let cached: Db | undefined;

// One pool per server process. `prepare: false` keeps the client compatible with
// Supabase's transaction pooler, which does not support prepared statements.
export function getDb(): Db {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }

  cached = drizzle(postgres(url, { max: Number(process.env.DATABASE_POOL_MAX ?? 5), prepare: false }), { schema });
  return cached;
}
