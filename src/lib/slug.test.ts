import { describe, expect, it } from "vitest";
import { parseSeasonSlug, slugify } from "./slug";

describe("slugify", () => {
  it("makes lowercase ASCII slugs", () => {
    expect(slugify("Kimetsu no Yaiba: Mugen Ressha-hen")).toBe(
      "kimetsu-no-yaiba-mugen-ressha-hen",
    );
  });

  it("removes accents and falls back when nothing ASCII remains", () => {
    expect(slugify("Pokémon")).toBe("pokemon");
    expect(slugify("鬼滅の刃")).toBe("anime");
  });
});

describe("parseSeasonSlug", () => {
  it("parses valid season slugs", () => {
    expect(parseSeasonSlug("2026-fall")).toEqual({ year: 2026, season: "fall" });
  });

  it("rejects malformed season slugs", () => {
    expect(parseSeasonSlug("fall-2026")).toBeNull();
    expect(parseSeasonSlug("2026-autumn")).toBeNull();
  });
});
