// Playback language preferences: audio and subtitle language (approved plan, section 5).
// Pure functions only. Reading the cookie and the profile happens in prefs-server.ts.

export const PREF_COOKIE = "prefs";
export const AUDIO_OPTIONS = ["ja", "en", "th"] as const;
export const SUB_OPTIONS = ["th", "en", "none"] as const;

export type AudioPref = (typeof AUDIO_OPTIONS)[number];
export type SubPref = (typeof SUB_OPTIONS)[number];
export type Prefs = { audio: AudioPref | null; sub: SubPref | null };

export const NO_PREFS: Prefs = { audio: null, sub: null };

export function isAudioPref(value: unknown): value is AudioPref {
  return typeof value === "string" && (AUDIO_OPTIONS as readonly string[]).includes(value);
}

export function isSubPref(value: unknown): value is SubPref {
  return typeof value === "string" && (SUB_OPTIONS as readonly string[]).includes(value);
}

// The cookie is untrusted input, so every field is checked again.
export function parsePrefCookie(raw: string | undefined): Prefs {
  if (!raw) return NO_PREFS;
  try {
    const value = JSON.parse(raw) as { audio?: unknown; sub?: unknown };
    return {
      audio: isAudioPref(value.audio) ? value.audio : null,
      sub: isSubPref(value.sub) ? value.sub : null,
    };
  } catch {
    return NO_PREFS;
  }
}

export function serializePrefs(prefs: Prefs): string {
  return JSON.stringify({ audio: prefs.audio, sub: prefs.sub });
}

// Signed-in profile wins over the cookie. The cookie covers guests and anyone whose profile
// has no value yet.
export function resolvePrefs(
  profile: { preferredAudio: string | null; preferredSub: string | null } | null,
  cookie: Prefs,
): Prefs {
  return {
    audio: isAudioPref(profile?.preferredAudio) ? profile.preferredAudio : cookie.audio,
    sub: isSubPref(profile?.preferredSub) ? profile.preferredSub : cookie.sub,
  };
}

// Which of a platform's tags match the viewer's choice. Used to highlight chips.
export function matchPrefs(
  platform: { audioLangs: string[]; subLangs: string[] },
  prefs: Prefs,
): { audio: boolean; sub: boolean } {
  return {
    audio: prefs.audio !== null && platform.audioLangs.includes(prefs.audio),
    sub: prefs.sub !== null && prefs.sub !== "none" && platform.subLangs.includes(prefs.sub),
  };
}
