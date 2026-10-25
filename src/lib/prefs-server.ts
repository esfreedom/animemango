import { cookies } from "next/headers";
import type { CurrentUser } from "./session";
import { parsePrefCookie, PREF_COOKIE, resolvePrefs, type Prefs } from "./prefs";

// Current playback preferences for this request: profile first, then the cookie.
export async function readPrefs(user: CurrentUser | null): Promise<Prefs> {
  const store = await cookies();
  return resolvePrefs(user, parsePrefCookie(store.get(PREF_COOKIE)?.value));
}

