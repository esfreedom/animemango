import { describe, expect, it } from "vitest";
import { computeCornerBadge, COVERAGE_MAX_AGE_MS, resolveLatestAired, type BadgeInput } from "./badge";
import { allowedHostsFrom, decideProposal, isAllowedSourceUrl } from "@/ai/policy";

const NOW = new Date("2026-10-25T03:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function input(overrides: Partial<BadgeInput> = {}): BadgeInput {
  return {
    status: "airing",
    entryKind: "tv",
    episodeCount: 12,
    latestAired: null,
    availability: [],
    now: NOW,
    ...overrides,
  };
}

const fullCopy = {
  availableTo: null,
  verifiedAt: new Date(NOW.getTime() - DAY),
  coversAllEpisodes: true,
  episodeFrom: null,
  episodeTo: null,
};

describe("computeCornerBadge", () => {
  it("shows the latest aired episode while the season is airing", () => {
    expect(computeCornerBadge(input({ latestAired: 7 }))).toEqual({ kind: "ep", number: 7 });
  });

  it("shows END for a finished season with a verified licensed copy of every episode", () => {
    const result = computeCornerBadge(input({ status: "finished", availability: [fullCopy] }));
    expect(result).toEqual({ kind: "end" });
  });

  it("still shows END when a rebroadcast ended but the full copy remains", () => {
    const rebroadcast = { ...fullCopy, coversAllEpisodes: false, episodeFrom: 1, episodeTo: 2 };
    const result = computeCornerBadge(input({ status: "finished", availability: [rebroadcast, fullCopy] }));
    expect(result).toEqual({ kind: "end" });
  });

  it("does not show END when the only copy covers part of the season", () => {
    const partial = { ...fullCopy, coversAllEpisodes: false, episodeFrom: 1, episodeTo: 5 };
    const result = computeCornerBadge(input({ status: "finished", latestAired: 12, availability: [partial] }));
    expect(result).toEqual({ kind: "ep", number: 12 });
  });

  it("does not show END for a season that is still airing, even with a full copy", () => {
    const result = computeCornerBadge(input({ status: "airing", availability: [fullCopy] }));
    expect(result).toEqual({ kind: "none" });
  });

  it("ignores availability that was ended or not verified recently", () => {
    const ended = { ...fullCopy, availableTo: new Date(NOW.getTime() - DAY) };
    const stale = { ...fullCopy, verifiedAt: new Date(NOW.getTime() - COVERAGE_MAX_AGE_MS - DAY) };
    const result = computeCornerBadge(input({ status: "finished", availability: [ended, stale] }));
    expect(result).toEqual({ kind: "ep", number: 12 });
  });

  it("shows END but no EP for movies and specials", () => {
    expect(computeCornerBadge(input({ entryKind: "movie", status: "finished", latestAired: 1, episodeCount: 1 }))).toEqual({
      kind: "none",
    });
    expect(
      computeCornerBadge(input({ entryKind: "special", status: "finished", availability: [fullCopy] })),
    ).toEqual({ kind: "end" });
  });

  it("falls back to the episode count for a finished season with no stored latest episode", () => {
    expect(computeCornerBadge(input({ status: "finished" }))).toEqual({ kind: "ep", number: 12 });
  });
});

describe("resolveLatestAired", () => {
  it("prefers the stored value from AniList", () => {
    expect(resolveLatestAired(9, [{ number: 1, airAtUtc: new Date(NOW.getTime() - DAY) }], NOW)).toBe(9);
  });

  it("falls back to the highest aired episode row", () => {
    const episodes = [
      { number: 6, airAtUtc: new Date(NOW.getTime() - 7 * DAY) },
      { number: 7, airAtUtc: new Date(NOW.getTime() - DAY) },
      { number: 8, airAtUtc: new Date(NOW.getTime() + DAY) },
    ];
    expect(resolveLatestAired(null, episodes, NOW)).toBe(7);
  });

  it("returns null when nothing has aired yet", () => {
    expect(resolveLatestAired(null, [{ number: 1, airAtUtc: new Date(NOW.getTime() + DAY) }], NOW)).toBeNull();
  });
});

describe("isAllowedSourceUrl", () => {
  const hosts = ["netflix.com"];

  it("accepts https links to AniList and to listed platform hosts", () => {
    expect(isAllowedSourceUrl("https://anilist.co/anime/21", hosts)).toBe(true);
    expect(isAllowedSourceUrl("https://www.netflix.com/th/title/123", hosts)).toBe(true);
  });

  it("rejects other hosts, lookalikes, and plain http", () => {
    expect(isAllowedSourceUrl("https://example.com/watch", hosts)).toBe(false);
    expect(isAllowedSourceUrl("https://netflix.com.evil.example/x", hosts)).toBe(false);
    expect(isAllowedSourceUrl("http://anilist.co/anime/21", hosts)).toBe(false);
    expect(isAllowedSourceUrl("not a url", hosts)).toBe(false);
  });
});

describe("allowedHostsFrom", () => {
  it("merges platform hosts with the environment list", () => {
    expect(allowedHostsFrom(["https://www.netflix.com"], "news.example.jp, , tv.example.th")).toEqual([
      "www.netflix.com",
      "news.example.jp",
      "tv.example.th",
    ]);
  });
});

describe("decideProposal", () => {
  const base = { sourcesAllowed: true, deterministic: false, ambiguous: false };

  it("auto-applies only deterministic, unambiguous structure", () => {
    expect(decideProposal("grouping", { ...base, deterministic: true })).toEqual({ action: "auto_apply" });
    expect(decideProposal("season_label", { ...base, deterministic: true, ambiguous: true })).toEqual({ action: "pending" });
    expect(decideProposal("grouping", base)).toEqual({ action: "pending" });
  });

  it("always sends availability, metadata and announcements to a person", () => {
    const deterministic = { ...base, deterministic: true };
    expect(decideProposal("availability", deterministic)).toEqual({ action: "pending" });
    expect(decideProposal("metadata", deterministic)).toEqual({ action: "pending" });
    expect(decideProposal("announcement", deterministic)).toEqual({ action: "pending" });
  });

  it("rejects anything with a source outside the allowlist", () => {
    expect(decideProposal("availability", { ...base, sourcesAllowed: false })).toEqual({
      action: "reject",
      reason: "source_not_allowed",
    });
  });
});
