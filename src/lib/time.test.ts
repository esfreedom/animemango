import { describe, expect, it } from "vitest";
import { bangkokDayRange, formatAirTime, parseTimeZone } from "./time";

describe("bangkokDayRange", () => {
  it("returns the Bangkok calendar day for a time in the morning", () => {
    // 2026-10-25 03:00 UTC is 10:00 in Bangkok.
    const range = bangkokDayRange(new Date("2026-10-25T03:00:00Z"));
    expect(range.from.toISOString()).toBe("2026-10-24T17:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-10-25T17:00:00.000Z");
  });

  it("rolls over correctly just after Bangkok midnight", () => {
    // 2026-10-24 17:30 UTC is 00:30 on 2026-10-25 in Bangkok.
    const range = bangkokDayRange(new Date("2026-10-24T17:30:00Z"));
    expect(range.from.toISOString()).toBe("2026-10-24T17:00:00.000Z");
  });
});

describe("parseTimeZone", () => {
  it("falls back to Asia/Bangkok for unknown zones", () => {
    expect(parseTimeZone("Mars/Olympus")).toBe("Asia/Bangkok");
    expect(parseTimeZone(undefined)).toBe("Asia/Bangkok");
    expect(parseTimeZone("Asia/Tokyo")).toBe("Asia/Tokyo");
  });
});

describe("formatAirTime", () => {
  it("formats in the requested zone", () => {
    const date = new Date("2026-10-25T12:00:00Z");
    expect(formatAirTime(date, "en", "Asia/Tokyo")).toContain("21:00");
    expect(formatAirTime(date, "en", "Asia/Bangkok")).toContain("19:00");
  });
});
