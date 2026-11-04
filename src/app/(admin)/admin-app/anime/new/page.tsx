import Link from "next/link";
import { connection } from "next/server";
import { createAnimeFromAniList } from "@/actions/admin";
import { AdminCard } from "@/components/admin/AdminCard";
import { inputClass, primaryClass } from "@/components/admin/styles";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCurrentUser, isAdmin } from "@/lib/session";

// Reads the session and data per request, so instant-navigation validation is opted out.
export const instant = false;

// Adding a title only needs its AniList id. Names, format, episodes and covers come from AniList,
// and the new title stays a draft until an admin publishes it from the list.
export default async function AdminNewAnimePage() {
  await connection();
  const user = await getCurrentUser();
  if (!isAdmin(user)) {
    return <EmptyState message="เฉพาะผู้ดูแลระบบ" />;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Link href="/anime" className="text-sm text-muted underline-offset-4 hover:underline">
          ← กลับรายการอนิเมะ
        </Link>
        <h1 className="text-2xl font-bold text-ink">เพิ่มอนิเมะ</h1>
      </div>

      <AdminCard
        id="add-anime"
        title="ดึงข้อมูลจาก AniList"
        description="ใส่ตัวเลขท้ายลิงก์ anilist.co/anime/… ระบบจะดึงชื่อ ประเภท จำนวนตอน และโปสเตอร์ให้ เรื่องที่เพิ่มจะเป็นฉบับร่าง"
      >
        <form action={createAnimeFromAniList} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-ink">
            AniList ID
            <input name="anilistId" type="number" min={1} required inputMode="numeric" className={`${inputClass} w-40`} />
          </label>
          <button type="submit" className={primaryClass}>
            บันทึกเป็นฉบับร่าง
          </button>
        </form>
      </AdminCard>
    </div>
  );
}
