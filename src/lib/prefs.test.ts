import { describe, expect, it } from "vitest";
import { matchPrefs, NO_PREFS, parsePrefCookie, resolvePrefs, serializePrefs } from "./prefs";

describe("parsePrefCookie", () => {
  it("reads a valid cookie", () => {
    expect(parsePrefCookie('{"audio":"ja","sub":"th"}')).toEqual({ audio: "ja", sub: "th" });
  });

  it("drops values it does not know and bad JSON", () => {
    expect(parsePrefCookie('{"audio":"fr","sub":"xx"}')).toEqual(NO_PREFS);
    expect(parsePrefCookie("not json")).toEqual(NO_PREFS);
    expect(parsePrefCookie(undefined)).toEqual(NO_PREFS);
  });

  it("round-trips through serializePrefs", () => {
    const prefs = { audio: "en" as const, sub: "none" as const };
    expect(parsePrefCookie(serializePrefs(prefs))).toEqual(prefs);
  });
});

describe("resolvePrefs", () => {
  const cookie = { audio: "ja" as const, sub: "en" as const };

  it("prefers the signed-in profile over the cookie", () => {
    expect(resolvePrefs({ preferredAudio: "th", preferredSub: "th" }, cookie)).toEqual({ audio: "th", sub: "th" });
  });

  it("uses the cookie when the profile has no value", () => {
    expect(resolvePrefs({ preferredAudio: null, preferredSub: "none" }, cookie)).toEqual({ audio: "ja", sub: "none" });
    expect(resolvePrefs(null, cookie)).toEqual(cookie);
  });

  it("ignores profile values that are no longer supported", () => {
    expect(resolvePrefs({ preferredAudio: "fr", preferredSub: null }, cookie)).toEqual(cookie);
  });
});

describe("matchPrefs", () => {
  it("matches audio and subtitles separately", () => {
    const platform = { audioLangs: ["ja", "th"], subLangs: ["th"] };
    expect(matchPrefs(platform, { audio: "th", sub: "en" })).toEqual({ audio: true, sub: false });
    expect(matchPrefs(platform, { audio: "en", sub: "th" })).toEqual({ audio: false, sub: true });
  });

  it("never highlights subtitles when the viewer chose none", () => {
    expect(matchPrefs({ audioLangs: [], subLangs: ["th"] }, { audio: null, sub: "none" })).toEqual({
      audio: false,
      sub: false,
    });
  });
});
