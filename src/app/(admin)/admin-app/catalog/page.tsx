import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import {
  addAnnouncement,
  addAvailability,
  addPlatform,
  addTrailer,
  addWatchOrderEntry,
  endAvailability,
  setOfficialTitle,
} from "@/actions/admin";
import { AdminCard } from "@/components/admin/AdminCard";
import { ADMIN_LOCALE, buttonClass, inputClass, primaryClass, tableClass, tdClass, thClass } from "@/components/admin/styles";
import { EmptyState } from "@/components/ui/EmptyState";
import { getActiveAvailability } from "@/data/admin";
import { getPlatforms } from "@/data/catalog";
import { getCurrentUser, isAdmin } from "@/lib/session";

export default async function AdminCatalogPage() {
  await connection();
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: "admin" });
  const user = await getCurrentUser();

  if (!isAdmin(user)) {
    return <EmptyState message={t("forbidden")} />;
  }

  const [availability, platforms] = await Promise.all([getActiveAvailability(), getPlatforms()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">ข้อมูลอนิเมะ</h1>

      <AdminCard id="official-titles" title={t("officialTitle")} description={t("officialTitleHelp")}>
        <form action={setOfficialTitle} className="grid gap-2 md:grid-cols-3">
          <input name="animeSlug" placeholder={t("animeSlug")} required className={inputClass} />
          <input name="titleTh" placeholder={t("officialTitleField")} required className={inputClass} />
          <input name="sourceUrl" type="url" placeholder={t("officialSourceField")} required className={inputClass} />
          <button type="submit" className={primaryClass}>{t("saveTitle")}</button>
        </form>
      </AdminCard>

      <AdminCard id="trailers" title={t("trailers")} description="ใส่ YouTube ID ของตัวอย่างจากช่องที่อนุมัติแล้วเท่านั้น">
        <form action={addTrailer} className="grid gap-2 md:grid-cols-4">
          <input name="animeSlug" placeholder={t("animeSlug")} required className={inputClass} />
          <input name="youtubeId" placeholder={t("youtubeId")} required className={inputClass} />
          <input name="channelId" placeholder={t("channelId")} required className={inputClass} />
          <button type="submit" className={primaryClass}>{t("addTrailer")}</button>
        </form>
      </AdminCard>

      <AdminCard id="availability" title={t("availabilityTitle")}>
        {availability.length === 0 ? (
          <EmptyState message="ยังไม่มีข้อมูล" />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>เรื่อง</th>
                  <th className={thClass}>แพลตฟอร์ม</th>
                  <th className={thClass}>เสียง / ซับ</th>
                  <th className={thClass}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {availability.map((item) => (
                  <tr key={item.id}>
                    <td className={tdClass}>{item.animeTitle}</td>
                    <td className={tdClass}>{item.platformName}</td>
                    <td className={tdClass}>
                      {item.audioLangs.join(",")} / {item.subLangs.join(",")}
                    </td>
                    <td className={tdClass}>
                      <form action={endAvailability}>
                        <input type="hidden" name="availabilityId" value={item.id} />
                        <button type="submit" className={buttonClass}>{t("endAvailability")}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form action={addAvailability} className="grid gap-2 md:grid-cols-3">
          <input name="animeSlug" placeholder={t("animeSlug")} required className={inputClass} />
          <input name="platformId" placeholder={t("platformId")} required className={inputClass} />
          <input name="region" placeholder={t("region")} defaultValue="TH" className={inputClass} />
          <input name="audioLangs" placeholder={t("audioLangs")} className={inputClass} />
          <input name="subLangs" placeholder={t("subLangs")} className={inputClass} />
          <input name="sourceUrl" type="url" placeholder={t("sourceUrl")} required className={inputClass} />
          <button type="submit" className={primaryClass}>{t("addAvailability")}</button>
        </form>
      </AdminCard>

      <AdminCard id="announcements-admin" title={t("announcements")} description="ประกาศจากทางการ ต้องมีลิงก์ต้นทางเสมอ">
        <form action={addAnnouncement} className="grid gap-2 md:grid-cols-2">
          <input name="title" placeholder={t("headline")} required className={inputClass} />
          <input name="sourceName" placeholder={t("sourceName")} required className={inputClass} />
          <input name="sourceUrl" type="url" placeholder={t("sourceUrl")} required className={inputClass} />
          <input name="publishedAt" type="datetime-local" required className={inputClass} />
          <input name="summary" placeholder={t("summary")} className={inputClass} />
          <input name="animeSlug" placeholder={t("animeSlug")} className={inputClass} />
          <button type="submit" className={primaryClass}>{t("addAnnouncement")}</button>
        </form>
      </AdminCard>

      <AdminCard id="watch-order-admin" title={t("watchOrderTitle")}>
        <form action={addWatchOrderEntry} className="grid gap-2 md:grid-cols-3">
          <input name="animeSlug" placeholder={t("franchiseSlug")} required className={inputClass} />
          <input name="relatedSlug" placeholder={t("relatedSlug")} required className={inputClass} />
          <input name="position" type="number" min={1} placeholder={t("position")} required className={inputClass} />
          <input name="relation" placeholder={t("relation")} required className={inputClass} />
          <input name="note" placeholder={t("note")} className={inputClass} />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="isSpoiler" /> {t("spoiler")}
          </label>
          <button type="submit" className={primaryClass}>{t("addWatchOrder")}</button>
        </form>
      </AdminCard>

      <AdminCard id="platforms-admin" title={t("platforms")}>
        {platforms.length === 0 ? (
          <EmptyState message="ยังไม่มีข้อมูล" />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>รหัส</th>
                  <th className={thClass}>ชื่อ</th>
                  <th className={thClass}>ภูมิภาค</th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((item) => (
                  <tr key={item.id}>
                    <td className={tdClass}>{item.id}</td>
                    <td className={tdClass}>{item.name}</td>
                    <td className={tdClass}>{item.regions.join(",")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form action={addPlatform} className="grid gap-2 md:grid-cols-3">
          <input name="name" placeholder={t("platformName")} required className={inputClass} />
          <input name="officialUrl" type="url" placeholder={t("officialUrl")} required className={inputClass} />
          <input name="regions" placeholder={t("region")} className={inputClass} />
          <button type="submit" className={primaryClass}>{t("addPlatform")}</button>
        </form>
      </AdminCard>
    </div>
  );
}
