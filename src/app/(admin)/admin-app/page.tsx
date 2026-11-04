import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminCard } from "@/components/admin/AdminCard";
import { ADMIN_LOCALE, panelClass } from "@/components/admin/styles";
import { getOpenTakedowns, getPendingProposals } from "@/data/admin";
import { getRecentReports } from "@/data/community";
import { listChannels } from "@/data/studios";
import { canModerate, getCurrentUser } from "@/lib/session";

export default async function AdminOverviewPage() {
  await connection();
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: "admin" });
  const user = await getCurrentUser();

  if (!canModerate(user)) {
    return <EmptyState message={t("forbidden")} />;
  }

  const [reports, drafts, takedowns, channels] = await Promise.all([
    getRecentReports(),
    getPendingProposals(),
    getOpenTakedowns(),
    listChannels(),
  ]);
  const openReports = reports.filter((item) => item.status !== "removed");
  const pendingChannels = channels.filter((item) => item.status === "pending");

  const tiles = [
    { href: "/moderation", label: "รายงานความเห็น", count: openReports.length },
    { href: "/moderation", label: "ร่างจาก AI รอตรวจ", count: drafts.length },
    { href: "/moderation", label: "คำขอแจ้งลบ", count: takedowns.length },
    { href: "/studios", label: "ช่องทางรอการอนุมัติ", count: pendingChannels.length },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t("title")}</h1>

      <AdminCard id="overview-queue" title="งานที่ต้องทำ" description="ตัวเลขนับจากคิวที่ยังไม่ปิด">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((tile) => (
            <li key={tile.label}>
              <Link href={tile.href} className={`${panelClass} block p-4 hover:bg-raised`}>
                <p className="text-xs text-muted">{tile.label}</p>
                <p className="mt-1 text-3xl font-semibold text-ink">{tile.count}</p>
              </Link>
            </li>
          ))}
        </ul>
      </AdminCard>
    </div>
  );
}
