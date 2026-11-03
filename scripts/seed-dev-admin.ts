// Creates the development back-office account: username "admin", password "0000".
// Usage: npm run db:seed-admin. It refuses to run when NODE_ENV is production, and it can be
// run again to reset the password. Password sign-in is for development only (approved plan, section 5).
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { adminCredential, users } from "../src/db/schema";
import { hashPassword } from "../src/lib/admin-password";
import { ADMIN_USERNAME } from "../src/lib/admin-session";

// Fixed id, so a re-run updates the same users row.
const ADMIN_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEV_PASSWORD = "0000";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to create the dev admin account when NODE_ENV is production.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const passwordHash = await hashPassword(DEV_PASSWORD);
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const db = drizzle(sql);
    await db
      .insert(users)
      .values({ id: ADMIN_USER_ID, username: ADMIN_USERNAME, displayName: "Admin (dev)", role: "admin" })
      .onConflictDoUpdate({ target: users.id, set: { role: "admin" } });
    await db
      .insert(adminCredential)
      .values({ username: ADMIN_USERNAME, passwordHash })
      .onConflictDoUpdate({ target: adminCredential.username, set: { passwordHash } });
    console.log(`Dev admin account "${ADMIN_USERNAME}" is ready. Sign in at /th/admin/login.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
