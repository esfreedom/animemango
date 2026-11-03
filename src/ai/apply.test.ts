import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { asAppDb, createPgliteDb, type PgliteDb } from "@/db/test-db";
import { anime, animeI18n, availabilityLog, platform, platformAvailability, proposal, series, users } from "@/db/schema";
import { applyProposal } from "./apply";

const ADMIN_ID = "00000000-0000-4000-8000-0000000000ad";

describe("applyProposal", () => {
  let db: PgliteDb;

  beforeEach(async () => {
    ({ db } = await createPgliteDb());
    await db.insert(users).values({ id: ADMIN_ID, username: "admin1", role: "admin" });
    await db.insert(platform).values({ name: "Netflix", regions: ["TH"], officialUrl: "https://www.netflix.com" });
    await db.insert(anime).values([
      { slug: "season-one", titleRomaji: "Season One", anilistId: 1 },
      { slug: "season-two", titleRomaji: "Season Two", anilistId: 2 },
    ]);
  });

  it("writes an approved availability proposal with coverage and a log entry", async () => {
    const [target] = await db.select().from(anime).where(eq(anime.slug, "season-one"));
    const [row] = await db
      .insert(proposal)
      .values({
        kind: "availability",
        animeId: target.id,
        payload: {
          platformName: "Netflix",
          region: "TH",
          audioLangs: ["ja"],
          subLangs: ["th"],
          coversAllEpisodes: true,
          episodeFrom: null,
          episodeTo: null,
          sourceUrl: "https://www.netflix.com/th/title/1",
        },
        sources: [{ field: "source", url: "https://www.netflix.com/th/title/1" }],
        aiModel: "test",
        promptVersion: "v1",
      })
      .returning();

    await applyProposal(asAppDb(db), row, ADMIN_ID);

    const [copy] = await db.select().from(platformAvailability);
    expect(copy.coversAllEpisodes).toBe(true);
    expect(copy.subLangs).toEqual(["th"]);
    expect(copy.verifiedBy).toBe(ADMIN_ID);
    expect(await db.select().from(availabilityLog)).toHaveLength(1);

    const [after] = await db.select().from(proposal).where(eq(proposal.id, row.id));
    expect(after.status).toBe("applied");
  });

  it("refuses an availability proposal for a platform that is not in the table", async () => {
    const [target] = await db.select().from(anime).where(eq(anime.slug, "season-one"));
    const [row] = await db
      .insert(proposal)
      .values({
        kind: "availability",
        animeId: target.id,
        payload: {
          platformName: "Unknown",
          region: "TH",
          audioLangs: [],
          subLangs: [],
          coversAllEpisodes: true,
          episodeFrom: null,
          episodeTo: null,
          sourceUrl: "https://example.com/x",
        },
        sources: [],
        aiModel: "test",
        promptVersion: "v1",
      })
      .returning();

    await expect(applyProposal(asAppDb(db), row, ADMIN_ID)).rejects.toThrow("unknown_platform");
    expect(await db.select().from(platformAvailability)).toHaveLength(0);
  });

  it("applies season labels and series membership from a structure proposal", async () => {
    const [group] = await db.insert(series).values({ slug: "sample", titleRomaji: "Sample", anilistRootId: 1 }).returning();
    const [row] = await db
      .insert(proposal)
      .values({
        kind: "season_label",
        seriesId: group.id,
        payload: {
          entries: [
            { animeSlug: "season-one", entryKind: "tv", seasonLabel: "SS1", sortOrder: 0 },
            { animeSlug: "season-two", entryKind: "tv", seasonLabel: "SS2", sortOrder: 1 },
          ],
        },
        sources: [],
        aiModel: "test",
        promptVersion: "v1",
      })
      .returning();

    await applyProposal(asAppDb(db), row, ADMIN_ID);

    const rows = await db.select().from(anime);
    expect(rows.map((item) => [item.slug, item.seasonLabel, item.seriesId === group.id])).toEqual([
      ["season-one", "SS1", true],
      ["season-two", "SS2", true],
    ]);
  });

  it("writes a Thai title only with its official source and keeps that source after a reviewer edit", async () => {
    const [target] = await db.select().from(anime).where(eq(anime.slug, "season-one"));
    const [row] = await db
      .insert(proposal)
      .values({
        kind: "metadata",
        animeId: target.id,
        payload: {
          titleTh: "ชื่อร่าง",
          titleSourceUrl: "https://www.netflix.com/th/title/1",
          synopsisTh: "เรื่องย่อร่าง",
          genresTh: [],
          unknownFields: [],
        },
        sources: [],
        aiModel: "test",
        promptVersion: "v1",
      })
      .returning();

    await applyProposal(asAppDb(db), row, ADMIN_ID, { titleTh: "ชื่อที่แก้แล้ว" });

    const [thai] = await db.select().from(animeI18n).where(eq(animeI18n.locale, "th"));
    expect(thai.title).toBe("ชื่อที่แก้แล้ว");
    expect(thai.source).toBe("official");
    expect(thai.sourceUrl).toBe("https://www.netflix.com/th/title/1");
    expect(thai.synopsis).toBe("เรื่องย่อร่าง");
  });

  it("does not publish a Thai title that has no official source", async () => {
    const [target] = await db.select().from(anime).where(eq(anime.slug, "season-one"));
    const [row] = await db
      .insert(proposal)
      .values({
        kind: "metadata",
        animeId: target.id,
        payload: { titleTh: "ชื่อร่าง", titleSourceUrl: null, synopsisTh: null, genresTh: [], unknownFields: [] },
        sources: [],
        aiModel: "test",
        promptVersion: "v1",
      })
      .returning();

    await expect(applyProposal(asAppDb(db), row, ADMIN_ID)).rejects.toThrow("title_needs_official_source");
    expect(await db.select().from(animeI18n)).toHaveLength(0);
  });

  it("writes nothing for Thai when the proposal has no Thai title", async () => {
    const [target] = await db.select().from(anime).where(eq(anime.slug, "season-one"));
    const [row] = await db
      .insert(proposal)
      .values({
        kind: "metadata",
        animeId: target.id,
        payload: { titleTh: null, synopsisTh: "เรื่องย่อ", genresTh: [], unknownFields: [] },
        sources: [],
        aiModel: "test",
        promptVersion: "v1",
      })
      .returning();

    await applyProposal(asAppDb(db), row, ADMIN_ID);
    expect(await db.select().from(animeI18n).where(eq(animeI18n.locale, "th"))).toHaveLength(0);
  });
});
