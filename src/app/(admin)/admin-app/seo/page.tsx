import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { AdminCard } from "@/components/admin/AdminCard";
import { ADMIN_LOCALE, tableClass, tdClass, thClass } from "@/components/admin/styles";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRecentSeoAudits } from "@/data/seo";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { summarizeIssues, type SeoIssue } from "@/lib/seo-audit";
import { formatAirTime } from "@/lib/time";

// Reads the session and data per request, so instant-navigation validation is opted out.
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

export default async function AdminSeoPage() {
  await connection();
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: "seoAudit" });
  const tAdmin = await getTranslations({ locale: ADMIN_LOCALE, namespace: "admin" });
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t("title")}</h1>
      <p className="max-w-2xl text-sm text-muted">{t("description")}</p>

      <AdminCard id="seo-summary" title={t("summary")}>
        {latest.length === 0 ? (
          <EmptyState message={t("none")} />
        ) : (
          <>
            <p className="text-sm text-muted">
              {t("lastRun", { time: formatAirTime(lastRun ?? new Date(), ADMIN_LOCALE, "Asia/Bangkok") })} · {t("checked", { count: latest.length })}
            </p>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {ISSUES.map((issue) => (
                <div key={issue} className="rounded-md border border-line bg-canvas p-3">
                  <dt className="text-xs text-muted">{t(`issues.${issue}`)}</dt>
                  <dd className="text-xl font-semibold text-ink">{counts[issue]}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </AdminCard>

      <AdminCard id="seo-flagged" title={t("flagged")}>
        {flagged.length === 0 ? (
          <EmptyState message={t("noneFlagged")} />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>URL</th>
                  <th className={thClass}>ปัญหา</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((row) => (
                  <tr key={row.url}>
                    <td className={`${tdClass} break-all`}>
                      <a href={row.url} rel="noopener noreferrer" target="_blank" className="underline-offset-4 hover:underline">
                        {row.url}
                      </a>
                    </td>
                    <td className={tdClass}>{row.issues.map((issue) => t(`issues.${issue}`)).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
