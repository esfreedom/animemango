// The internal SEO bot. It takes a random sample of the public pages listed in the sitemap, fetches
// each one politely, and checks it with auditPage (see seo-audit.ts). The functions here take their
// fetch, sleep and random source as arguments, so they can be tested without a network.
import { auditPage, type SeoIssue } from "./seo-audit";

export const BOT_USER_AGENT = "AnimeHubSeoBot/1.0 (internal audit)";
export const SAMPLE_LIMIT = 100;
export const REQUEST_DELAY_MS = 1000;

// Title, series and single-episode pages carry structured data. Season pages and search do not.
const JSON_LD_PATH = /^\/[a-z]{2}\/(anime|series)\/[^/]+\/?$/;

export type FetchedPage = { statusCode: number; html: string };

export type AuditRow = { url: string; statusCode: number; issues: SeoIssue[] };

// Every <loc> value in a sitemap document.
export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1].replaceAll("&amp;", "&"));
}

// Fisher-Yates shuffle, then the first `limit` URLs. Each run looks at different pages.
export function sampleUrls(urls: string[], limit: number, random: () => number = Math.random): string[] {
  const copy = [...urls];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, limit);
}

export function expectsJsonLd(url: string): boolean {
  return JSON_LD_PATH.test(new URL(url).pathname);
}

export type SeoBotOptions = {
  sitemapXml: string;
  limit: number;
  fetchPage: (url: string) => Promise<FetchedPage>;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

// Every URL in the sample is expected to be indexed, because the sitemap only lists pages with
// official Thai content (see sitemap.ts).
export async function runSeoBot({
  sitemapXml,
  limit,
  fetchPage,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random,
}: SeoBotOptions): Promise<AuditRow[]> {
  const urls = sampleUrls(sitemapLocs(sitemapXml), limit, random);
  const rows: AuditRow[] = [];

  for (const [index, url] of urls.entries()) {
    if (index > 0) await sleep(REQUEST_DELAY_MS);

    let page: FetchedPage;
    try {
      page = await fetchPage(url);
    } catch {
      // A network failure counts as a failed page. Status 0 means no response.
      page = { statusCode: 0, html: "" };
    }

    const issues = auditPage({
      url,
      statusCode: page.statusCode,
      html: page.html,
      expectJsonLd: expectsJsonLd(url),
      expectIndexed: true,
    });
    rows.push({ url, statusCode: page.statusCode, issues });
  }

  return rows;
}
