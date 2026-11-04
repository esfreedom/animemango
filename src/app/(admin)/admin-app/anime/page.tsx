import Link from "next/link";
import { connection } from "next/server";
import { setAnimePublished } from "@/actions/admin";
import { AdminCard } from "@/components/admin/AdminCard";
import { buttonClass, primaryClass, tableClass, tdClass, thClass } from "@/components/admin/styles";
import { EmptyState } from "@/components/ui/EmptyState";
import { countAnimeByPublished, listAnimeForAdmin, type AnimeShow } from "@/data/admin";
import { getCurrentUser, isAdmin } from "@/lib/session";

// Reads the session and data per request, so instant-navigation validation is opted out.
export const instant = false;

const TABS: { show: AnimeShow; label: string }[] = [
  { show: "all", label: "ทั้งหมด" },
  { show: "published", label: "เผยแพร่แล้ว" },
  { show: "draft", label: "ฉบับร่าง" },
];

const STATUS_LABEL = {
  upcoming: "ยังไม่ฉาย",
  airing: "กำลังฉาย",
  finished: "จบแล้ว",
  hiatus: "พักฉาย",
} as const;

// One row per title. Publishing is a single button, and the tabs filter the list without a page change.
export default async function AdminAnimePage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!isAdmin(user)) {
    return <EmptyState message="เฉพาะผู้ดูแลระบบ" />;
  }

  const { show } = await searchParams;
  const current: AnimeShow = TABS.some((tab) => tab.show === show) ? (show as AnimeShow) : "all";
  const [rows, counts] = await Promise.all([listAnimeForAdmin(current), countAnimeByPublished()]);
  const currentTab = TABS.find((tab) => tab.show === current)!;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-ink">รายการอนิเมะ</h1>
          <p className="text-sm text-muted">เรื่องที่เผยแพร่แล้วจะขึ้นบนเว็บทันที ฉบับร่างผู้ชมจะไม่เห็น</p>
        </div>
        <Link href="/anime/new" className={`${primaryClass} inline-flex items-center`}>
          + เพิ่มอนิเมะ
        </Link>
      </div>

      <nav aria-label="กรองรายการ" className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = tab.show === current;
          const href = tab.show === "all" ? "/anime" : `/anime?show=${tab.show}`;
          const count = tab.show === "all" ? counts.all : tab.show === "published" ? counts.published : counts.draft;
          return (
            <Link
              key={tab.show}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md border border-line px-3 py-1.5 text-sm ${
                active ? "bg-raised font-semibold text-ink" : "text-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {tab.label} ({count})
            </Link>
          );
        })}
      </nav>

      <AdminCard id="anime-list" title={currentTab.label}>
        {rows.length === 0 ? (
          <EmptyState message="ยังไม่มีรายการในกลุ่มนี้" />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>ชื่อเรื่อง</th>
                  <th className={thClass}>รูปแบบ · ตอน</th>
                  <th className={thClass}>สถานะฉาย</th>
                  <th className={thClass}>ช่องทางดู</th>
                  <th className={thClass}>การเผยแพร่</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className={tdClass}>
                      <p className="font-semibold text-ink">{row.titleTh ?? row.titleRomaji}</p>
                      <p className="text-xs text-muted">
                        {row.titleRomaji} · {row.slug}
                      </p>
                    </td>
                    <td className={tdClass}>
                      {row.format ?? "-"} · {row.episodeCount ?? "?"} ตอน
                    </td>
                    <td className={tdClass}>{STATUS_LABEL[row.status]}</td>
                    <td className={tdClass}>{row.platformCount}</td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={setAnimePublished} className="flex items-center gap-2">
                          <input type="hidden" name="animeId" value={row.id} />
                          <input type="hidden" name="published" value={row.published ? "false" : "true"} />
                          <span className={`text-xs ${row.published ? "text-ink" : "text-muted"}`}>
                            {row.published ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
                          </span>
                          <button type="submit" className={row.published ? buttonClass : primaryClass}>
                            {row.published ? "ซ่อน" : "เผยแพร่"}
                          </button>
                        </form>
                        {row.published && (
                          <a
                            href={`${siteUrl}/th/anime/${row.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted underline-offset-4 hover:underline"
                          >
                            ดูหน้าเว็บ
                          </a>
                        )}
                      </div>
                    </td>
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
