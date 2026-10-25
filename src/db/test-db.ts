import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "./client";
import * as schema from "./schema";

// In-process Postgres for tests and the local dev server. Migrations are the same
// files that run against Supabase, so queries are checked against the real schema.
export async function createPgliteDb(dataDir?: string) {
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });
  return { client, db };
}

export type PgliteDb = Awaited<ReturnType<typeof createPgliteDb>>["db"];

// The app code is typed against the postgres-js driver. PGlite exposes the same
// query builder, so tests cast it to the app type instead of duplicating every function.
export function asAppDb(db: PgliteDb): Db {
  return db as unknown as Db;
}
