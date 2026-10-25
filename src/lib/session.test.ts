import type { User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { asAppDb, createPgliteDb, type PgliteDb } from "@/db/test-db";
import { users } from "@/db/schema";
import { profileFromAuthUser, syncUserRecord } from "./session";

const USER_ID = "00000000-0000-4000-8000-0000000000aa";

// Shape of a Supabase user after a Google sign-in.
function googleUser(overrides: { email?: string | null; user_metadata?: Record<string, unknown> } = {}): User {
  return {
    id: USER_ID,
    aud: "authenticated",
    app_metadata: { provider: "google" },
    user_metadata: {
      full_name: "Esfre Freedom",
      avatar_url: "https://lh3.googleusercontent.com/a/example",
    },
    email: "es.freedom@gmail.com",
    created_at: "2026-10-25T00:00:00Z",
    ...overrides,
  } as User;
}

describe("profileFromAuthUser", () => {
  it("reads the Google name and https picture", () => {
    const profile = profileFromAuthUser(googleUser());
    expect(profile.displayName).toBe("Esfre Freedom");
    expect(profile.avatarUrl).toBe("https://lh3.googleusercontent.com/a/example");
  });

  it("drops pictures that are not https", () => {
    const profile = profileFromAuthUser(
      googleUser({ user_metadata: { full_name: "A", picture: "http://insecure.example/a.png" } }),
    );
    expect(profile.avatarUrl).toBeNull();
  });
});

describe("syncUserRecord", () => {
  let db: PgliteDb;

  beforeEach(async () => {
    ({ db } = await createPgliteDb());
  });

  it("creates a user on first sign-in with a username from the email", async () => {
    const row = await syncUserRecord(asAppDb(db), googleUser());

    expect(row.id).toBe(USER_ID);
    expect(row.username).toMatch(/^esfreedom[a-z0-9]{4}$/);
    expect(row.displayName).toBe("Esfre Freedom");
    expect(row.role).toBe("user");
    // The email is never copied into the public users table.
    expect(Object.keys(row)).not.toContain("email");
  });

  it("returns the same row on later sign-ins without changing the username", async () => {
    const first = await syncUserRecord(asAppDb(db), googleUser());
    const second = await syncUserRecord(asAppDb(db), googleUser());

    expect(second.username).toBe(first.username);
    expect(await db.select().from(users).where(eq(users.id, USER_ID))).toHaveLength(1);
  });

  it("refreshes the display name and picture when Google reports new values", async () => {
    await syncUserRecord(asAppDb(db), googleUser());
    const updated = await syncUserRecord(
      asAppDb(db),
      googleUser({
        user_metadata: { full_name: "New Name", avatar_url: "https://lh3.googleusercontent.com/a/new" },
      }),
    );

    expect(updated.displayName).toBe("New Name");
    expect(updated.avatarUrl).toBe("https://lh3.googleusercontent.com/a/new");
  });

  it("falls back to a neutral username when the email has no usable characters", async () => {
    const row = await syncUserRecord(asAppDb(db), googleUser({ email: "ที่@gmail.com" }));
    expect(row.username).toMatch(/^user[a-z0-9]{4}$/);
  });
});
