import { describe, expect, it } from "vitest";
import {
  MAX_EXTRA_ENTRIES,
  resolveSeriesGraph,
  seriesTitleFrom,
  type GraphEdge,
  type GraphMedia,
} from "./series-graph";

function media(id: number, format: string, startDate: string, title: string, edges: GraphEdge[] = [], type = "ANIME"): GraphMedia {
  return { id, type, format, startDate, title, edges };
}

function edge(relationType: string, node: GraphMedia): GraphEdge {
  return { relationType, node: { id: node.id, type: node.type, format: node.format, startDate: node.startDate, title: node.title } };
}

// Builds a fetch function over a fixed set of nodes.
function fetcher(nodes: GraphMedia[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return async (id: number) => byId.get(id) ?? null;
}

describe("resolveSeriesGraph", () => {
  it("finds every TV season through PREQUEL and SEQUEL and labels them in order", async () => {
    const s1 = media(1, "TV", "2020-10-03", "Jujutsu Kaisen");
    const s2 = media(2, "TV", "2023-07-06", "Jujutsu Kaisen 2nd Season");
    const s3 = media(3, "TV", "2026-01-10", "Jujutsu Kaisen 3rd Season");
    // Links are stored on both sides, as AniList does.
    s1.edges = [edge("SEQUEL", s2)];
    s2.edges = [edge("PREQUEL", s1), edge("SEQUEL", s3)];
    s3.edges = [edge("PREQUEL", s2)];

    const entries = await resolveSeriesGraph(2, fetcher([s1, s2, s3]));

    expect(entries.map((entry) => [entry.id, entry.kind, entry.seasonLabel])).toEqual([
      [1, "tv", "SS1"],
      [2, "tv", "SS2"],
      [3, "tv", "SS3"],
    ]);
  });

  it("adds movies, OVAs and specials linked by SIDE_STORY or SUMMARY, and skips other relations", async () => {
    const tv = media(1, "TV", "1999-10-20", "Sample Show");
    const movie = media(10, "MOVIE", "2001-03-01", "Sample Show: The Movie");
    const special = media(11, "SPECIAL", "2002-04-01", "Sample Show Special");
    const alternative = media(12, "MOVIE", "2003-05-01", "Alternative Universe");
    const character = media(13, "SPECIAL", "2004-06-01", "Character Story");
    const manga = media(14, "MANGA", "1997-01-01", "Source Manga", [], "MANGA");
    tv.edges = [
      edge("SIDE_STORY", movie),
      edge("SUMMARY", special),
      edge("ALTERNATIVE", alternative),
      edge("CHARACTER", character),
      edge("SOURCE", manga),
    ];

    const entries = await resolveSeriesGraph(1, fetcher([tv, movie, special, alternative, character, manga]));

    expect(entries.map((entry) => [entry.id, entry.kind, entry.seasonLabel])).toEqual([
      [1, "tv", null],
      [10, "movie", null],
      [11, "special", null],
    ]);
  });

  it("caps extras so a long-running series does not pull in dozens of specials", async () => {
    const tv = media(1, "TV", "1999-10-20", "One Piece");
    const extras = Array.from({ length: MAX_EXTRA_ENTRIES + 10 }, (_, index) =>
      media(100 + index, "SPECIAL", `2000-01-${String((index % 27) + 1).padStart(2, "0")}`, `Special ${index}`),
    );
    tv.edges = extras.map((extra) => edge("SIDE_STORY", extra));

    const entries = await resolveSeriesGraph(1, fetcher([tv, ...extras]));

    expect(entries.filter((entry) => entry.kind === "special")).toHaveLength(MAX_EXTRA_ENTRIES);
  });

  it("returns nothing when the root is not a TV entry", async () => {
    const movie = media(5, "MOVIE", "2010-01-01", "Only A Movie");
    expect(await resolveSeriesGraph(5, fetcher([movie]))).toEqual([]);
  });

  it("returns nothing when the root is missing", async () => {
    expect(await resolveSeriesGraph(404, fetcher([]))).toEqual([]);
  });
});

describe("seriesTitleFrom", () => {
  it.each([
    ["Jujutsu Kaisen 2nd Season", "Jujutsu Kaisen"],
    ["Attack on Titan Season 3", "Attack on Titan"],
    ["Mob Psycho 100 S2", "Mob Psycho 100"],
    ["Sousou no Frieren: Season 2", "Sousou no Frieren"],
    ["ONE PIECE", "ONE PIECE"],
  ])("turns %s into %s", (input, expected) => {
    expect(seriesTitleFrom(input)).toBe(expected);
  });
});
