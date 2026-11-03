import { describe, expect, it } from "vitest";
import { isOfficialTitleSource, validateOfficialTitle } from "./official-title";

const HOSTS = ["www.netflix.com", "muse.example.th"];

describe("isOfficialTitleSource", () => {
  it("accepts https pages on listed official hosts", () => {
    expect(isOfficialTitleSource("https://www.netflix.com/th/title/123", HOSTS)).toBe(true);
    expect(isOfficialTitleSource("https://news.muse.example.th/post", HOSTS)).toBe(true);
  });

  it("never accepts AniList, even when it is listed", () => {
    expect(isOfficialTitleSource("https://anilist.co/anime/21", [...HOSTS, "anilist.co"])).toBe(false);
  });

  it("rejects unlisted hosts and plain http", () => {
    expect(isOfficialTitleSource("https://random-site.example/title", HOSTS)).toBe(false);
    expect(isOfficialTitleSource("http://www.netflix.com/th/title/123", HOSTS)).toBe(false);
  });
});

describe("validateOfficialTitle", () => {
  it("accepts a Thai name with an official source", () => {
    expect(validateOfficialTitle({ titleTh: " โดราเอมอน ", sourceUrl: "https://www.netflix.com/th/title/1" }, HOSTS)).toEqual({
      ok: true,
      titleTh: "โดราเอมอน",
    });
  });

  it("rejects names without Thai letters", () => {
    const result = validateOfficialTitle({ titleTh: "Doraemon", sourceUrl: "https://www.netflix.com/th/title/1" }, HOSTS);
    expect(result).toEqual({ ok: false, errors: ["title_needs_thai"] });
  });

  it("reports every problem at once", () => {
    const result = validateOfficialTitle({ titleTh: "", sourceUrl: "https://anilist.co/anime/1" }, HOSTS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual(["title_length", "title_needs_thai", "source_not_official"]);
  });
});
