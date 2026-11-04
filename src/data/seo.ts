import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seoAudit } from "@/db/schema";

// The most recent bot checks, newest first. The back-office SEO page summarizes them.
export async function getRecentSeoAudits(limit = 200) {
  return getDb()
    .select({
      url: seoAudit.url,
      statusCode: seoAudit.statusCode,
      issues: seoAudit.issues,
      checkedAt: seoAudit.checkedAt,
    })
    .from(seoAudit)
    .orderBy(desc(seoAudit.checkedAt))
    .limit(limit);
}
