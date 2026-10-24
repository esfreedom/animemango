import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Only needed for migrate/push. `db:generate` works without a database.
    url: process.env.DATABASE_URL ?? "",
  },
});
