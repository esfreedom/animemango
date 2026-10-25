import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { asAppDb, createPgliteDb, type PgliteDb } from "@/db/test-db";
import { aiDraft, anime, animeI18n } from "@/db/schema";
import { parseJsonObject } from "./anthropic";
import { runDraftPipeline, type DraftModel } from "./pipeline";
import { validateDraftFields, validateSources } from "./validator";

const GOOD = {
  titleTh: "ตัวอย่างอนิเมะ",
  synopsisTh: "อนิเมะแนวแอ็กชัน ฉาย 12 ตอน เริ่มออกอากาศปี 2026",
  genresTh: ["แอ็กชัน", "แฟนตาซี"],
  unknownFields: [],
};

describe("validateDraftFields", () => {
  it("accepts a well-formed draft", () => {
    expect(validateDraftFields(GOOD).ok).toBe(true);
  });

  it("rejects unknown keys such as video or stream fields", () => {
    const result = validateDraftFields({ ...GOOD, streamUrl: "https://example.com/ep1.m3u8" });
    expect(result.ok).toBe(false);
  });

  it("rejects links inside text", () => {
    const result = validateDraftFields({ ...GOOD, synopsisTh: "ดูได้ที่ https://example.com" });
    expect(result).toEqual({ ok: false, errors: ["synopsisTh: contains a link"] });
  });

  it("rejects overly long titles", () => {
    expect(validateDraftFields({ ...GOOD, titleTh: "ก".repeat(300) }).ok).toBe(false);
  });
});

describe("validateSources", () => {
  it("only allows the AniList page of the drafted title", () => {
    const allowed = new Set(["https://anilist.co/anime/101"]);
    expect(validateSources([{ field: "titleTh", url: "https://anilist.co/anime/101" }], allowed)).toEqual([]);
    expect(validateSources([{ field: "titleTh", url: "https://example.com/x" }], allowed)).toHaveLength(1);
  });
});

describe("parseJsonObject", () => {
  it("reads JSON wrapped in a code fence", () => {
    expect(parseJsonObject('```json\n{"titleTh": null}\n```')).toEqual({ titleTh: null });
  });

  it("throws when there is no object", () => {
    expect(() => parseJsonObject("no json here")).toThrow();
  });
});

describe("runDraftPipeline", () => {
  let db: PgliteDb;

  beforeEach(async () => {
    ({ db } = await createPgliteDb());
    await db.insert(anime).values([
      { slug: "good-show", titleRomaji: "Good Show", anilistId: 1, genres: ["Action"], episodeCount: 12 },
      { slug: "bad-show", titleRomaji: "Bad Show", anilistId: 2, genres: [] },
      { slug: "done-show", titleRomaji: "Done Show", anilistId: 3, genres: [] },
    ]);
    const [done] = await db.select().from(anime).where(eq(anime.slug, "done-show"));
    await db.insert(animeI18n).values({ animeId: done.id, locale: "th", title: "เสร็จแล้ว", source: "human" });
  });

  it("creates drafts, rejects bad output, and skips titles that already have Thai text", async () => {
    const model: DraftModel = {
      async draft(input) {
        return input.titleRomaji === "Bad Show" ? { ...GOOD, streamUrl: "x" } : GOOD;
      },
    };

    const result = await runDraftPipeline({
      db: asAppDb(db),
      model,
      modelName: "test-model",
      limit: 10,
    });

    expect(result).toEqual({ created: 1, rejected: 1, failed: 0 });

    const drafts = await db.select().from(aiDraft);
    expect(drafts.map((row) => row.status).sort()).toEqual(["draft", "rejected"]);
    expect(drafts.every((row) => row.promptVersion && row.aiModel === "test-model")).toBe(true);
  });

  it("does not write anything to the public titles table", async () => {
    await runDraftPipeline({ db: asAppDb(db), model: { draft: async () => GOOD }, modelName: "m", limit: 10 });
    const thai = await db.select().from(animeI18n);
    expect(thai.filter((row) => row.locale === "th").map((row) => row.title)).toEqual(["เสร็จแล้ว"]);
  });
});
