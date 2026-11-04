import { getDb } from "@/db/client";
import { seoAudit } from "@/db/schema";
import { BOT_USER_AGENT, runSeoBot, SAMPLE_LIMIT, type FetchedPage } from "@/lib/seo-bot";
import { getSiteUrl } from "@/lib/site";

// Checks a random sample of public pages from the sitemap and stores the results for the back office at /seo.
// Runs hourly (see vercel.json). The sample is capped, and each request waits a second.
export const maxDuration = 300;

const PAGE_TIMEOUT_MS = 10_000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const requested = Number(new URL(request.url).searchParams.get("limit") ?? SAMPLE_LIMIT);
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, SAMPLE_LIMIT) : SAMPLE_LIMIT;

  const sitemap = await fetch(`${getSiteUrl()}/sitemap.xml`, {
    headers: { "user-agent": BOT_USER_AGENT },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  if (!sitemap.ok) return Response.json({ error: "sitemap_unavailable" }, { status: 502 });

  const rows = await runSeoBot({
    sitemapXml: await sitemap.text(),
    limit,
    fetchPage: fetchHtml,
  });

  if (rows.length > 0) {
    await getDb().insert(seoAudit).values(rows.map((row) => ({ url: row.url, statusCode: row.statusCode, issues: row.issues })));
  }

  return Response.json({
    ok: true,
    checked: rows.length,
    withIssues: rows.filter((row) => row.issues.length > 0).length,
  });
}

// Redirects are not followed, so a moved page shows up as a status problem in the report.
async function fetchHtml(url: string): Promise<FetchedPage> {
  const response = await fetch(url, {
    redirect: "manual",
    headers: { "user-agent": BOT_USER_AGENT },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  return { statusCode: response.status, html: response.status === 200 ? await response.text() : "" };
}
