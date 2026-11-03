import { describe, expect, it } from "vitest";
import { expectsJsonLd, runSeoBot, sampleUrls, sitemapLocs, type FetchedPage } from "./seo-bot";

const GOOD_HTML = `<html><head>
<title>Title</title>
<meta name="description" content="Desc">
<link rel="canonical" href="https://a.test/th/anime/x">
<link rel="alternate" hreflang="th" href="https://a.test/th/anime/x">
<link rel="alternate" hreflang="en" href="https://a.test/en/anime/x">
<link rel="alternate" hreflang="ja" href="https://a.test/ja/anime/x">
<script type="application/ld+json">{}</script>
</head><body></body></html>`;

describe("sitemapLocs", () => {
  it("reads every loc and decodes ampersands", () => {
    const xml = `<urlset><url><loc>https://a.test/th?x=1&amp;y=2</loc></url><url><loc> https://a.test/en </loc></url></urlset>`;
    expect(sitemapLocs(xml)).toEqual(["https://a.test/th?x=1&y=2", "https://a.test/en"]);
  });
});

describe("sampleUrls", () => {
  it("returns no repeats and at most the limit", () => {
    const urls = Array.from({ length: 20 }, (_, index) => `https://a.test/${index}`);
    const sample = sampleUrls(urls, 5, () => 0.42);
    expect(sample).toHaveLength(5);
    expect(new Set(sample).size).toBe(5);
  });

  it("returns everything when the limit is larger than the list", () => {
    expect(sampleUrls(["a", "b"], 100)).toHaveLength(2);
  });
});

describe("expectsJsonLd", () => {
  it("is set for title and series pages only", () => {
    expect(expectsJsonLd("https://a.test/th/anime/one-piece")).toBe(true);
    expect(expectsJsonLd("https://a.test/en/series/one-piece/")).toBe(true);
    expect(expectsJsonLd("https://a.test/th/anime/one-piece/ep/3")).toBe(false);
    expect(expectsJsonLd("https://a.test/th/schedule")).toBe(false);
  });
});

describe("runSeoBot", () => {
  const sitemap = `<urlset>
    <url><loc>https://a.test/th/anime/x</loc></url>
    <url><loc>https://a.test/en/schedule</loc></url>
    <url><loc>https://a.test/ja/anime/y</loc></url>
  </urlset>`;

  it("audits each sampled page and waits between requests", async () => {
    const pages = new Map<string, FetchedPage>([
      ["https://a.test/th/anime/x", { statusCode: 200, html: GOOD_HTML }],
      ["https://a.test/en/schedule", { statusCode: 404, html: "" }],
      ["https://a.test/ja/anime/y", { statusCode: 200, html: "<html></html>" }],
    ]);
    const waits: number[] = [];

    const rows = await runSeoBot({
      sitemapXml: sitemap,
      limit: 10,
      random: () => 0,
      sleep: async (ms) => {
        waits.push(ms);
      },
      fetchPage: async (url) => pages.get(url) ?? { statusCode: 404, html: "" },
    });

    expect(rows).toHaveLength(3);
    expect(waits).toEqual([1000, 1000]);

    const byUrl = Object.fromEntries(rows.map((row) => [row.url, row.issues]));
    expect(byUrl["https://a.test/th/anime/x"]).toEqual([]);
    expect(byUrl["https://a.test/en/schedule"]).toEqual(["status_not_200"]);
    expect(byUrl["https://a.test/ja/anime/y"]).toContain("missing_title");
  });

  it("records a network failure as status 0 without stopping the run", async () => {
    const rows = await runSeoBot({
      sitemapXml: sitemap,
      limit: 10,
      random: () => 0,
      sleep: async () => {},
      fetchPage: async () => {
        throw new Error("offline");
      },
    });

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.statusCode === 0 && row.issues.includes("status_not_200"))).toBe(true);
  });
});
