import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { getRecentSeoAudits } from "@/data/seo";
import { preparePage } from "@/lib/page";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { summarizeIssues, type SeoIssue } from "@/lib/seo-audit";
import { formatAirTime } from "@/lib/time";

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

const ISSUES = [
  "status_not_200",
  "missing_title",
  "missing_description",
  "canonical_mismatch",
  "missing_hreflang",
  "missing_jsonld",
  "noindex_mismatch",
] as const satisfies readonly SeoIssue[];

export default async function AdminSeoPage({ params }: PageProps<"/[locale]/admin/seo">) {
  const locale = await preparePage(params);
  const t = await getTranslations("seoAudit");
  const tAdmin = await getTranslations("admin");
  const user = await getCurrentUser();

  if (!isAdmin(user)) {
    return <EmptyState message={tAdmin("forbidden")} />;
  }

  // Only the newest check of each URL counts, so old runs do not inflate the totals.
  const rows = await getRecentSeoAudits();
  const newest = new Map<string, { url: string; statusCode: number | null; issues: SeoIssue[]; checkedAt: Date }>();
  for (const row of rows) {
    if (!newest.has(row.url)) {
      newest.set(row.url, { ...row, issues: row.issues as SeoIssue[] });
    }
  }
  const latest = [...newest.values()];
  const counts = summarizeIssues(latest);
  const flagged = latest.filter((row) => row.issues.length > 0);
  const lastRun = rows[0]?.checkedAt;

  return (
    <div className="space-y-12">
      <Link href="/admin" className="text-sm text-muted underline-offset-4 hover:underline">
        {t("backToAdmin")}
      </Link>
      <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>
      <p className="max-w-2xl text-sm text-muted">{t("description")}</p>

      <Section id="seo-summary" title={t("summary")}>
        {latest.length === 0 ? (
          <EmptyState message={t("none")} />
        ) : (
          <>
            <p className="text-sm text-muted">
              {t("lastRun", { time: formatAirTime(lastRun ?? new Date(), locale, "Asia/Bangkok") })} · {t("checked", { count: latest.length })}
            </p>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {ISSUES.map((issue) => (
                <div key={issue} className="rounded-md border border-line bg-surface p-3">
                  <dt className="text-xs text-muted">{t(`issues.${issue}`)}</dt>
                  <dd className="text-xl font-semibold text-ink">{counts[issue]}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Section>

      <Section id="seo-flagged" title={t("flagged")}>
        {flagged.length === 0 ? (
          <EmptyState message={t("noneFlagged")} />
        ) : (
          <ul className="space-y-2 text-sm">
            {flagged.map((row) => (
              <li key={row.url} className="space-y-1 rounded-md border border-line bg-surface px-3 py-2">
                <a href={row.url} rel="noopener noreferrer" target="_blank" className="block break-all text-ink underline-offset-4 hover:underline">
                  {row.url}
                </a>
                <p className="text-xs text-muted">{row.issues.map((issue) => t(`issues.${issue}`)).join(" · ")}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
