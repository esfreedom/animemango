// Checks one rendered page for the SEO rules in DESIGN.md section 10. Pure: the bot fetches the
// page, then passes the status and HTML here.

export const LOCALES = ["th", "en", "ja"] as const;

export type SeoIssue =
  | "status_not_200"
  | "missing_title"
  | "missing_description"
  | "canonical_mismatch"
  | "missing_hreflang"
  | "missing_jsonld"
  | "noindex_mismatch";

export type PageFacts = {
  url: string;
  statusCode: number;
  html: string;
  // Pages about a title or series must carry structured data (TVSeries, TVSeason, TVEpisode).
  expectJsonLd: boolean;
  // The page should be indexed only when it has official Thai content.
  expectIndexed: boolean;
};

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag);
  return match ? match[1] : null;
}

function firstTag(html: string, pattern: RegExp): string | null {
  const match = pattern.exec(html);
  return match ? match[0] : null;
}

export function auditPage(page: PageFacts): SeoIssue[] {
  const issues: SeoIssue[] = [];
  if (page.statusCode !== 200) return ["status_not_200"];

  const { html } = page;
  if (!/<title>[^<]+<\/title>/i.test(html)) issues.push("missing_title");

  const description = firstTag(html, /<meta[^>]+name="description"[^>]*>/i);
  if (!description || !attr(description, "content")) issues.push("missing_description");

  const canonical = firstTag(html, /<link[^>]+rel="canonical"[^>]*>/i);
  const canonicalHref = canonical ? attr(canonical, "href") : null;
  if (canonicalHref && canonicalHref !== page.url) issues.push("canonical_mismatch");

  const hreflangs = [...html.matchAll(/<link[^>]+hreflang="([^"]+)"[^>]*>/gi)].map((match) => match[1].toLowerCase());
  if (!LOCALES.every((locale) => hreflangs.includes(locale))) issues.push("missing_hreflang");

  if (page.expectJsonLd && !/<script[^>]+application\/ld\+json/i.test(html)) issues.push("missing_jsonld");

  const robots = firstTag(html, /<meta[^>]+name="robots"[^>]*>/i);
  const noindex = robots ? /noindex/i.test(attr(robots, "content") ?? "") : false;
  if (noindex === page.expectIndexed) issues.push("noindex_mismatch");

  return issues;
}

export function summarizeIssues(results: { issues: SeoIssue[] }[]): Record<SeoIssue, number> {
  const counts = {
    status_not_200: 0,
    missing_title: 0,
    missing_description: 0,
    canonical_mismatch: 0,
    missing_hreflang: 0,
    missing_jsonld: 0,
    noindex_mismatch: 0,
  } satisfies Record<SeoIssue, number>;
  for (const result of results) {
    for (const issue of result.issues) counts[issue] += 1;
  }
  return counts;
}
