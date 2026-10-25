import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { asAppDb, createPgliteDb, type PgliteDb } from "@/db/test-db";
import {
  anime,
  animeFollow,
  animeI18n,
  episode,
  episodeScheduleLog,
  notification,
  thread,
  users,
} from "@/db/schema";
import type { AniListAiringEntry } from "./client";
import { mapMedia } from "./mapper";
import { series } from "@/db/schema";
import { syncAiringWindow } from "./sync";

const NOW = new Date("2026-10-25T03:00:00Z");
const WINDOW = { from: new Date("2026-10-24T00:00:00Z"), to: new Date("2026-11-08T00:00:00Z") };

function media(overrides: Partial<AniListAiringEntry["media"]> & { id: number }): AniListAiringEntry["media"] {
  return {
    idMal: null,
    format: "TV",
    status: "RELEASING",
    episodes: 12,
    genres: ["Action"],
    averageScore: 80,
    season: "FALL",
    seasonYear: 2026,
    startDate: { year: 2026, month: 10, day: 4 },
    title: { romaji: "Test Title", english: "Test Title EN", native: "テスト" },
    coverImage: { extraLarge: "https://s4.anilist.co/file/example.jpg" },
    bannerImage: null,
    isAdult: false,
    ...overrides,
  };
}

const FIXTURE: AniListAiringEntry[] = [
  { episode: 3, airingAt: 1792893600, media: media({ id: 101, title: { romaji: "Sample Show", english: "Sample Show", native: "サンプル" } }) },
  { episode: 4, airingAt: 1793498400, media: media({ id: 101, title: { romaji: "Sample Show", english: "Sample Show", native: "サンプル" } }) },
  { episode: 1, airingAt: 1792900000, media: media({ id: 202, title: { romaji: "Other Show", english: null, native: null } }) },
  { episode: 1, airingAt: 1792900000, media: media({ id: 303, isAdult: true, title: { romaji: "Adult", english: null, native: null } }) },
];

// Answers both AniList queries used by the sync: the airing window and single-title relations.
// Titles without relation edges form a series of one, so the relations answer is minimal.
function fakeAniList(entries: AniListAiringEntry[], relationCalls: number[] = []): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { query: string; variables: Record<string, number> };
    if (body.query.includes("MediaWithRelations")) {
      relationCalls.push(body.variables.id);
      const found = entries.find((entry) => entry.media.id === body.variables.id);
      const media = found ? { ...found.media, type: "ANIME", relations: { edges: [] } } : null;
      return new Response(JSON.stringify({ data: { Media: media } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        data: { Page: { pageInfo: { hasNextPage: false }, airingSchedules: entries } },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
}

describe("mapMedia", () => {
  it("skips adult titles", () => {
    expect(mapMedia(media({ id: 1, isAdult: true }))).toBeNull();
  });

  it("maps status, season and start date", () => {
    const mapped = mapMedia(media({ id: 2, status: "NOT_YET_RELEASED", season: "SPRING" }));
    expect(mapped?.status).toBe("upcoming");
    expect(mapped?.season).toBe("spring");
    expect(mapped?.startDate).toBe("2026-10-04");
  });
});

describe("syncAiringWindow", () => {
  let db: PgliteDb;

  beforeEach(async () => {
    ({ db } = await createPgliteDb());
  });

  it("creates titles, episodes, threads and official titles on the first run", async () => {
    const app = asAppDb(db);
    const result = await syncAiringWindow({
      db: app,
      ...WINDOW,
      now: NOW,
      fetchImpl: fakeAniList(FIXTURE),
    });

    expect(result).toEqual({ titles: 2, episodes: 3, scheduleChanges: 0, notifications: 0 });

    const titles = await db.select().from(anime);
    expect(titles.map((row) => row.slug).sort()).toEqual(["other-show", "sample-show"]);

    const sample = titles.find((row) => row.slug === "sample-show");
    const episodes = await db.select().from(episode).where(eq(episode.animeId, sample!.id));
    expect(episodes.map((row) => row.number).sort()).toEqual([3, 4]);

    const i18n = await db.select().from(animeI18n).where(eq(animeI18n.animeId, sample!.id));
    expect(i18n.map((row) => row.locale).sort()).toEqual(["en", "ja"]);
    expect(i18n.every((row) => row.source === "official")).toBe(true);

    const threads = await db.select().from(thread);
    // One thread per title plus one per episode.
    expect(threads).toHaveLength(2 + 3);
  });

  it("is idempotent when the same window is synced twice", async () => {
    const app = asAppDb(db);
    await syncAiringWindow({ db: app, ...WINDOW, now: NOW, fetchImpl: fakeAniList(FIXTURE) });
    const second = await syncAiringWindow({ db: app, ...WINDOW, now: NOW, fetchImpl: fakeAniList(FIXTURE) });

    expect(second.scheduleChanges).toBe(0);
    expect(await db.select().from(anime)).toHaveLength(2);
    expect(await db.select().from(thread)).toHaveLength(5);
  });

  it("logs schedule moves and notifies followers", async () => {
    const app = asAppDb(db);
    await syncAiringWindow({ db: app, ...WINDOW, now: NOW, fetchImpl: fakeAniList(FIXTURE) });

    const [sample] = await db.select().from(anime).where(eq(anime.slug, "sample-show"));
    const [user] = await db
      .insert(users)
      .values({ id: "00000000-0000-4000-8000-000000000001", username: "fan" })
      .returning();
    await db.insert(animeFollow).values({ animeId: sample.id, userId: user.id });

    const moved = FIXTURE.map((entry) =>
      entry.media.id === 101 && entry.episode === 4 ? { ...entry, airingAt: entry.airingAt + 3600 } : entry,
    );
    const result = await syncAiringWindow({ db: app, ...WINDOW, now: NOW, fetchImpl: fakeAniList(moved) });

    expect(result.scheduleChanges).toBe(1);
    expect(result.notifications).toBe(1);

    const logs = await db.select().from(episodeScheduleLog);
    expect(logs).toHaveLength(1);

    const [note] = await db.select().from(notification);
    expect(note.userId).toBe(user.id);
    expect(note.href).toBe("/th/anime/sample-show/ep/4");
  });

  it("groups a new title into a series once and does not ask AniList for its relations again", async () => {
    const app = asAppDb(db);
    const firstCalls: number[] = [];
    await syncAiringWindow({ db: app, ...WINDOW, now: NOW, fetchImpl: fakeAniList(FIXTURE, firstCalls) });

    const [sample] = await db.select().from(anime).where(eq(anime.slug, "sample-show"));
    const [group] = await db.select().from(series);
    expect(group.slug).toBe("sample-show");
    expect(sample.seriesId).toBe(group.id);
    expect(sample.entryKind).toBe("tv");
    expect(sample.seasonLabel).toBeNull();
    expect(firstCalls).toContain(101);

    const secondCalls: number[] = [];
    await syncAiringWindow({ db: app, ...WINDOW, now: NOW, fetchImpl: fakeAniList(FIXTURE, secondCalls) });
    expect(secondCalls).toEqual([]);
  });

  it("labels seasons, sets entry kinds and keeps movies under the same series", async () => {
    // Two TV seasons linked by SEQUEL/PREQUEL, and a movie linked to season 1 by SIDE_STORY.
    const season1 = media({
      id: 201,
      startDate: { year: 2020, month: 10, day: 3 },
      title: { romaji: "Chain Show", english: "Chain Show", native: null },
    });
    const season2 = media({
      id: 202,
      startDate: { year: 2026, month: 1, day: 10 },
      title: { romaji: "Chain Show 2nd Season", english: null, native: null },
    });
    const movie = media({
      id: 203,
      format: "MOVIE",
      episodes: 1,
      startDate: { year: 2025, month: 3, day: 1 },
      title: { romaji: "Chain Show: The Movie", english: null, native: null },
    });
    const nodes: Record<number, unknown> = {
      201: { ...season1, type: "ANIME", relations: { edges: [
        { relationType: "SEQUEL", node: { id: 202, type: "ANIME", format: "TV", startDate: { year: 2026, month: 1, day: 10 }, title: { romaji: "Chain Show 2nd Season", english: null, native: null } } },
        { relationType: "SIDE_STORY", node: { id: 203, type: "ANIME", format: "MOVIE", startDate: { year: 2025, month: 3, day: 1 }, title: { romaji: "Chain Show: The Movie", english: null, native: null } } },
        { relationType: "ALTERNATIVE", node: { id: 999, type: "ANIME", format: "MOVIE", startDate: null, title: { romaji: "Other", english: null, native: null } } },
      ] } },
      202: { ...season2, type: "ANIME", relations: { edges: [
        { relationType: "PREQUEL", node: { id: 201, type: "ANIME", format: "TV", startDate: { year: 2020, month: 10, day: 3 }, title: { romaji: "Chain Show", english: null, native: null } } },
      ] } },
      203: { ...movie, type: "ANIME", relations: { edges: [] } },
    };
    const airing: AniListAiringEntry[] = [
      { episode: 1, airingAt: 1792900000, media: season2 },
    ];
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { query: string; variables: Record<string, number> };
      if (body.query.includes("MediaWithRelations")) {
        return new Response(JSON.stringify({ data: { Media: nodes[body.variables.id] ?? null } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ data: { Page: { pageInfo: { hasNextPage: false }, airingSchedules: airing } } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const app = asAppDb(db);
    await syncAiringWindow({ db: app, ...WINDOW, now: NOW, fetchImpl });

    const rows = await db.select().from(anime);
    const byId = new Map(rows.map((row) => [row.anilistId, row]));
    expect(byId.get(201)?.seasonLabel).toBe("SS1");
    expect(byId.get(202)?.seasonLabel).toBe("SS2");
    expect(byId.get(202)?.entryKind).toBe("tv");
    expect(byId.get(203)?.entryKind).toBe("movie");
    expect(byId.get(203)?.seasonLabel).toBeNull();
    expect(byId.has(999)).toBe(false);

    const seriesRows = await db.select().from(series);
    expect(seriesRows.map((row) => row.slug)).toEqual(["chain-show"]);
    expect(new Set(rows.filter((row) => [201, 202, 203].includes(row.anilistId ?? 0)).map((row) => row.seriesId))).toEqual(
      new Set([seriesRows[0].id]),
    );
  });

  it("never stores adult titles", async () => {
    const app = asAppDb(db);
    await syncAiringWindow({ db: app, ...WINDOW, now: NOW, fetchImpl: fakeAniList(FIXTURE) });
    const adult = await db.select().from(anime).where(eq(anime.anilistId, 303));
    expect(adult).toHaveLength(0);
  });
});
