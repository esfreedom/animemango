import { describe, expect, it } from "vitest";
import { hasThaiContent, resolveSynopsis, resolveTitle, resolveTitleSource } from "./titles";
import { currentSeason, seasonSlug } from "./slug";

const TITLES = [
  { locale: "en", title: "Sample Show", synopsis: "English synopsis", source: "official" },
  { locale: "ja", title: "サンプル", synopsis: null, source: "official" },
];

describe("resolveTitle", () => {
  it("uses the viewer's language when it exists", () => {
    expect(resolveTitle(TITLES, "ja", "Sample Romaji")).toEqual({
      title: "サンプル",
      isFallback: false,
      locale: "ja",
    });
  });

  it("falls back to English and marks it, then to romaji", () => {
    expect(resolveTitle(TITLES, "th", "Sample Romaji")).toEqual({
      title: "Sample Show",
      isFallback: true,
      locale: "en",
    });
    expect(resolveTitle([], "th", "Sample Romaji")).toEqual({
      title: "Sample Romaji",
      isFallback: true,
      locale: "romaji",
    });
  });
});

describe("resolveSynopsis", () => {
  it("returns the English synopsis as a fallback when Thai is missing", () => {
    expect(resolveSynopsis(TITLES, "th")).toEqual({ synopsis: "English synopsis", isFallback: true });
  });

  it("returns null when no synopsis exists", () => {
    expect(resolveSynopsis([{ locale: "ja", title: "x", source: "official" }], "th")).toBeNull();
  });
});

describe("hasThaiContent", () => {
  it("is true only when an official Thai title exists", () => {
    expect(hasThaiContent(TITLES)).toBe(false);
    expect(hasThaiContent([...TITLES, { locale: "th", title: "ตัวอย่าง", source: "human" }])).toBe(false);
    expect(
      hasThaiContent([...TITLES, { locale: "th", title: "ตัวอย่าง", source: "official", sourceUrl: "https://www.netflix.com/th" }]),
    ).toBe(true);
  });

  it("shows a Thai title only when it is official, and names its source", () => {
    const unofficial = [...TITLES, { locale: "th", title: "ชื่อร่าง", source: "machine", sourceUrl: null }];
    expect(resolveTitle(unofficial, "th", "Sample Romaji")).toEqual({ title: "Sample Show", isFallback: true, locale: "en" });

    const official = [...TITLES, { locale: "th", title: "ชื่อทางการ", source: "official", sourceUrl: "https://www.netflix.com/th/title/1" }];
    expect(resolveTitle(official, "th", "Sample Romaji")).toEqual({ title: "ชื่อทางการ", isFallback: false, locale: "th" });
    expect(resolveTitleSource(official, "th")).toBe("https://www.netflix.com/th/title/1");
    expect(resolveTitleSource(official, "en")).toBeNull();
  });
});

describe("currentSeason", () => {
  it("maps Bangkok months to broadcast seasons", () => {
    expect(currentSeason(new Date("2026-10-25T03:00:00Z"))).toEqual({ year: 2026, season: "fall" });
    expect(currentSeason(new Date("2026-01-15T03:00:00Z"))).toEqual({ year: 2026, season: "winter" });
    expect(currentSeason(new Date("2026-07-01T03:00:00Z"))).toEqual({ year: 2026, season: "summer" });
  });

  it("uses Bangkok time at the boundary", () => {
    // 2026-03-31 18:00 UTC is 2026-04-01 01:00 in Bangkok, so spring.
    expect(currentSeason(new Date("2026-03-31T18:00:00Z")).season).toBe("spring");
    expect(seasonSlug(2026, "spring")).toBe("2026-spring");
  });
});
