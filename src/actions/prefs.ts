"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { routing } from "@/i18n/routing";
import { isAudioPref, isSubPref, PREF_COOKIE, serializePrefs } from "@/lib/prefs";
import { getCurrentUser } from "@/lib/session";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Saves the playback language choice. Guests get a cookie. Signed-in users also get the profile.
export async function setPreferences(input: { audio: string | null; sub: string | null }): Promise<void> {
  const audio = isAudioPref(input.audio) ? input.audio : null;
  const sub = isSubPref(input.sub) ? input.sub : null;

  const store = await cookies();
  store.set(PREF_COOKIE, serializePrefs({ audio, sub }), {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });

  const user = await getCurrentUser();
  if (user) {
    await getDb()
      .update(users)
      .set({ preferredAudio: audio, preferredSub: sub })
      .where(eq(users.id, user.id));
  }
}

// Remembers the interface language in the profile. The cookie is set by the language switcher.
export async function saveLocalePreference(locale: string): Promise<void> {
  if (!(routing.locales as readonly string[]).includes(locale)) return;

  const user = await getCurrentUser();
  if (user) {
    await getDb().update(users).set({ locale }).where(eq(users.id, user.id));
  }
}
