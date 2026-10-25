import { describe, expect, it } from "vitest";
import { checkOpsToken } from "./ops-auth";
import { parseProposalPayload } from "@/ai/proposals";

describe("checkOpsToken", () => {
  it("accepts only the exact bearer token", () => {
    expect(checkOpsToken("Bearer secret-value", "secret-value")).toBe("ok");
    expect(checkOpsToken("Bearer secret-valuX", "secret-value")).toBe("unauthorized");
    expect(checkOpsToken("Bearer short", "secret-value")).toBe("unauthorized");
    expect(checkOpsToken(null, "secret-value")).toBe("unauthorized");
    expect(checkOpsToken("Basic secret-value", "secret-value")).toBe("unauthorized");
  });

  it("refuses everything when the token is not configured", () => {
    expect(checkOpsToken("Bearer anything", undefined)).toBe("not_configured");
  });
});

describe("parseProposalPayload", () => {
  const availability = {
    platformName: "Netflix",
    region: "TH",
    audioLangs: ["ja", "th"],
    subLangs: ["th"],
    coversAllEpisodes: true,
    episodeFrom: null,
    episodeTo: null,
    sourceUrl: "https://www.netflix.com/th/title/123",
  };

  it("accepts a complete availability proposal and returns its source", () => {
    const result = parseProposalPayload("availability", availability);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.sourceUrls).toEqual(["https://www.netflix.com/th/title/123"]);
  });

  it("rejects stream or video fields in any kind", () => {
    expect(parseProposalPayload("availability", { ...availability, streamUrl: "https://x.example/a.m3u8" }).ok).toBe(false);
    expect(parseProposalPayload("announcement", { title: "Title here", sourceName: "Studio", sourceUrl: "https://studio.example/n", publishedAt: "2026-10-25T03:00:00Z", videoUrl: "x" }).ok).toBe(false);
  });

  it("requires an episode range when coverage is partial", () => {
    expect(parseProposalPayload("availability", { ...availability, coversAllEpisodes: false }).ok).toBe(false);
    expect(
      parseProposalPayload("availability", { ...availability, coversAllEpisodes: false, episodeFrom: 1, episodeTo: 5 }).ok,
    ).toBe(true);
    expect(
      parseProposalPayload("availability", { ...availability, coversAllEpisodes: false, episodeFrom: 9, episodeTo: 5 }).ok,
    ).toBe(false);
  });

  it("validates structure proposals and rejects empty entry lists", () => {
    expect(parseProposalPayload("season_label", { entries: [] }).ok).toBe(false);
    const ok = parseProposalPayload("season_label", {
      entries: [{ animeSlug: "black-clover-2nd-season", entryKind: "tv", seasonLabel: "SS2", sortOrder: 1 }],
    });
    expect(ok.ok).toBe(true);
  });

  it("checks metadata with the existing draft validator", () => {
    expect(parseProposalPayload("metadata", { titleTh: "ตัวอย่าง", synopsisTh: "ดูที่ https://x.example", genresTh: [], unknownFields: [] }).ok).toBe(false);
  });
});
