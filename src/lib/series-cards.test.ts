import { describe, expect, it } from "vitest";
import { groupIntoSeriesCards, NEW_WINDOW_MS, RECENT_LIMIT, type CardEntry } from "./series-cards";

const NOW = new Date("2026-11-03T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3600_000);
const hoursAhead = (hours: number) => new Date(NOW.getTime() + hours * 3600_000);

function entry(overrides: Partial<CardEntry> & { slug: string }): CardEntry {
  return {
    seriesSlug: null,
    lastAiredAt: null,
    nextAirAt: null,
    nextEpisode: null,
    episodes: [],
    ...overrides,
  };
}

describe("groupIntoSeriesCards", () => {
  it("puts seasons of one series on a single card", () => {
    const cards = groupIntoSeriesCards(
      [
        entry({ slug: "op-s1", seriesSlug: "one-piece", lastAiredAt: hoursAgo(5) }),
        entry({ slug: "op-s2", seriesSlug: "one-piece", lastAiredAt: hoursAgo(2) }),
        entry({ slug: "solo", lastAiredAt: hoursAgo(1) }),
      ],
      NOW,
    );

    expect(cards).toHaveLength(2);
    expect(cards[0].key).toBe("anime:solo");
    expect(cards[1].members.map((item) => item.slug)).toEqual(["op-s1", "op-s2"]);
  });

  it("uses the entry that aired most recently as the cover", () => {
    const [card] = groupIntoSeriesCards(
      [
        entry({ slug: "s1", seriesSlug: "x", lastAiredAt: hoursAgo(30) }),
        entry({ slug: "s2", seriesSlug: "x", lastAiredAt: hoursAgo(3) }),
      ],
      NOW,
    );
    expect(card.primary.slug).toBe("s2");
    expect(card.lastAiredAt?.getTime()).toBe(hoursAgo(3).getTime());
  });

  it("orders aired series newest first, then upcoming-only series soonest first", () => {
    const cards = groupIntoSeriesCards(
      [
        entry({ slug: "later", nextAirAt: hoursAhead(50), nextEpisode: 1 }),
        entry({ slug: "old", lastAiredAt: hoursAgo(20) }),
        entry({ slug: "fresh", lastAiredAt: hoursAgo(2) }),
        entry({ slug: "soon", nextAirAt: hoursAhead(4), nextEpisode: 3 }),
      ],
      NOW,
    );
    expect(cards.map((card) => card.primary.slug)).toEqual(["fresh", "old", "soon", "later"]);
  });

  it("keeps the next episode of a series that is also airing", () => {
    const [card] = groupIntoSeriesCards(
      [
        entry({ slug: "s1", seriesSlug: "x", lastAiredAt: hoursAgo(2) }),
        entry({ slug: "s2", seriesSlug: "x", nextAirAt: hoursAhead(24), nextEpisode: 1 }),
      ],
      NOW,
    );
    expect(card.nextEpisode).toBe(1);
    expect(card.nextAirAt?.getTime()).toBe(hoursAhead(24).getTime());
  });

  it("lists only aired episodes, newest first, capped at the recent limit", () => {
    const episodes = [1, 2, 3, 4, 5].map((number) => ({ number, airAtUtc: hoursAgo(10 - number) }));
    episodes.push({ number: 6, airAtUtc: hoursAhead(2) });
    const [card] = groupIntoSeriesCards([entry({ slug: "s1", lastAiredAt: hoursAgo(5), episodes })], NOW);

    expect(card.recent).toHaveLength(RECENT_LIMIT);
    expect(card.recent.map((item) => item.number)).toEqual([5, 4, 3]);
  });

  it("marks a card new only while its latest episode is inside the new window", () => {
    const fresh = groupIntoSeriesCards([entry({ slug: "a", lastAiredAt: new Date(NOW.getTime() - NEW_WINDOW_MS / 2) })], NOW);
    const stale = groupIntoSeriesCards([entry({ slug: "b", lastAiredAt: new Date(NOW.getTime() - NEW_WINDOW_MS * 2) })], NOW);
    const upcoming = groupIntoSeriesCards([entry({ slug: "c", nextAirAt: hoursAhead(2), nextEpisode: 1 })], NOW);

    expect(fresh[0].isNew).toBe(true);
    expect(stale[0].isNew).toBe(false);
    expect(upcoming[0].isNew).toBe(false);
  });
});
