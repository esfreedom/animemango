import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { approveProposal, rejectProposal, setTakedownStatus } from "@/actions/admin";
import { setCommentStatus } from "@/actions/comments";
import { AdminCard } from "@/components/admin/AdminCard";
import { ADMIN_LOCALE, buttonClass, primaryClass, tableClass, tdClass, thClass } from "@/components/admin/styles";
import { EmptyState } from "@/components/ui/EmptyState";
import { getOpenTakedowns, getPendingProposals } from "@/data/admin";
import { getRecentReports } from "@/data/community";
import { canModerate, getCurrentUser, isAdmin } from "@/lib/session";

// Reads the session and data per request, so instant-navigation validation is opted out.
export const instant = false;

export default async function AdminModerationPage() {
  await connection();
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: "admin" });
  const user = await getCurrentUser();

  if (!canModerate(user)) {
    return <EmptyState message={t("forbidden")} />;
  }

  const reports = await getRecentReports();
  const openReports = reports.filter((item) => item.status !== "removed");
  const admin = isAdmin(user);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">คิวตรวจ</h1>

      <AdminCard id="reports" title={t("reports")} description="ความเห็นที่ผู้ใช้รายงาน ซ่อน ลบ หรือคืนได้">
        {openReports.length === 0 ? (
          <EmptyState message={t("reportsEmpty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>ความเห็น</th>
                  <th className={thClass}>เหตุผล</th>
                  <th className={thClass}>สถานะ</th>
                  <th className={thClass}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {openReports.map((item) => (
                  <tr key={item.id}>
                    <td className={`${tdClass} max-w-md whitespace-pre-wrap`}>{item.body}</td>
                    <td className={tdClass}>{item.reason}</td>
                    <td className={tdClass}>{item.status}</td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap gap-2">
                        {(["hidden", "removed", "visible"] as const).map((status) => (
                          <form key={status} action={setCommentStatus}>
                            <input type="hidden" name="commentId" value={item.commentId} />
                            <input type="hidden" name="status" value={status} />
                            <button type="submit" className={buttonClass}>
                              {status === "hidden" ? t("hide") : status === "removed" ? t("remove") : t("restore")}
                            </button>
                          </form>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {admin && <AdminOnlyQueues />}
    </div>
  );
}

async function AdminOnlyQueues() {
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: "admin" });
  const [proposals, takedowns] = await Promise.all([getPendingProposals(), getOpenTakedowns()]);

  return (
    <>
      <AdminCard id="proposals" title={t("drafts")} description="ร่างจาก AI ต้องตรวจก่อนเผยแพร่ ระบบไม่เผยแพร่เอง">
        {proposals.length === 0 ? (
          <EmptyState message={t("draftsEmpty")} />
        ) : (
          <ul className="space-y-4">
            {proposals.map((item) => {
              const payload = item.payload as { titleTh?: string | null; synopsisTh?: string | null };
              const label = item.animeTitle ?? item.seriesTitle ?? "";
              return (
                <li key={item.id} className="space-y-3 rounded-md border border-line p-4">
                  <p className="text-xs text-muted">
                    {item.kind} · {label} · {item.aiModel} · {item.promptVersion}
                  </p>
                  {item.kind === "metadata" ? (
                    <form action={approveProposal} className="grid gap-2 md:grid-cols-2">
                      <input type="hidden" name="proposalId" value={item.id} />
                      <label className="flex flex-col gap-1 text-xs text-muted">
                        {t("titleField")}
                        <input name="titleTh" defaultValue={payload.titleTh ?? ""} className={inputFieldClass} />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-muted">
                        {t("synopsisField")}
                        <textarea name="synopsisTh" defaultValue={payload.synopsisTh ?? ""} rows={3} className={inputFieldClass} />
                      </label>
                      <div className="flex gap-2 md:col-span-2">
                        <button type="submit" className={primaryClass}>
                          {t("approve")}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <pre className="max-h-60 overflow-auto rounded bg-canvas p-3 text-xs text-muted">
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                      <form action={approveProposal}>
                        <input type="hidden" name="proposalId" value={item.id} />
                        <button type="submit" className={primaryClass}>
                          {t("approve")}
                        </button>
                      </form>
                    </>
                  )}
                  <form action={rejectProposal}>
                    <input type="hidden" name="proposalId" value={item.id} />
                    <button type="submit" className={buttonClass}>
                      {t("reject")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </AdminCard>

      <AdminCard id="takedowns" title={t("takedowns")} description="คำขอแจ้งลบจากผู้ถือสิทธิ์">
        {takedowns.length === 0 ? (
          <EmptyState message={t("takedownsEmpty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>ลิงก์</th>
                  <th className={thClass}>เหตุผล</th>
                  <th className={thClass}>ผู้แจ้ง</th>
                  <th className={thClass}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {takedowns.map((item) => (
                  <tr key={item.id}>
                    <td className={`${tdClass} break-all`}>{item.url}</td>
                    <td className={`${tdClass} whitespace-pre-wrap`}>{item.reason}</td>
                    <td className={tdClass}>
                      {item.requesterName}
                      <br />
                      <span className="text-xs text-muted">{item.requesterEmail}</span>
                    </td>
                    <td className={tdClass}>
                      <div className="flex gap-2">
                        <form action={setTakedownStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="status" value="actioned" />
                          <button type="submit" className={buttonClass}>{t("markActioned")}</button>
                        </form>
                        <form action={setTakedownStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="status" value="rejected" />
                          <button type="submit" className={buttonClass}>{t("markRejected")}</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </>
  );
}

const inputFieldClass = "h-9 rounded-md border border-line bg-canvas px-3 text-sm text-ink";
