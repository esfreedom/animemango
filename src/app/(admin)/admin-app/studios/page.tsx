import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import {
  addStudioChannel,
  createStudio,
  deleteStudioLink,
  linkStudioAnime,
  setChannelApproval,
} from "@/actions/studios";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  ADMIN_LOCALE,
  buttonClass,
  inputClass,
  primaryClass,
  selectClass,
  tableClass,
  tdClass,
  thClass,
} from "@/components/admin/styles";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { listChannels, listStudioLinks, listStudios } from "@/data/studios";
import { getCurrentUser, isAdmin } from "@/lib/session";

const KINDS = ["studio", "distributor", "platform", "rights_holder"] as const;
const ROLES = ["produce", "distribute", "licensor"] as const;
const PLATFORMS = ["youtube", "facebook", "x", "website"] as const;

export default async function AdminStudiosPage() {
  await connection();
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: "studio" });
  const tAdmin = await getTranslations({ locale: ADMIN_LOCALE, namespace: "admin" });
  const user = await getCurrentUser();

  if (!isAdmin(user)) {
    return <EmptyState message={tAdmin("forbidden")} />;
  }

  const [studios, channels, links] = await Promise.all([listStudios(), listChannels(), listStudioLinks()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">{t("adminTitle")}</h1>

      <AdminCard id="studio-create" title={t("createTitle")} description="โปรไฟล์ค่ายหรือผู้เผยแพร่ ใช้ slug ภาษาอังกฤษตัวเล็ก">
        {studios.length > 0 && (
          <ul className="flex flex-wrap gap-2 text-xs text-muted">
            {studios.map((item) => (
              <li key={item.id} className="rounded border border-line px-2 py-1">
                {item.nameRomaji} <span>({item.slug})</span>
              </li>
            ))}
          </ul>
        )}
        <form action={createStudio} className="grid gap-2 md:grid-cols-4">
          <input name="nameRomaji" placeholder={t("name")} required className={inputClass} />
          <input name="slug" placeholder={t("slug")} required pattern="[a-z0-9\-]{2,80}" className={inputClass} />
          <select name="kind" defaultValue="studio" aria-label={t("kindField")} className={selectClass}>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`kind.${kind}`)}
              </option>
            ))}
          </select>
          <input name="websiteUrl" type="url" placeholder={t("website")} className={inputClass} />
          <button type="submit" className={primaryClass}>{t("create")}</button>
        </form>
      </AdminCard>

      <AdminCard id="studio-channels" title={t("channels")} description="ช่องใหม่จะรอตรวจ ยังไม่มีการฝังตัวอย่างจนกว่าจะอนุมัติ">
        <form action={addStudioChannel} className="grid gap-2 md:grid-cols-3">
          <input name="studioSlug" placeholder={t("studioSlug")} required className={inputClass} />
          <select name="platform" defaultValue="youtube" aria-label={t("platformField")} className={selectClass}>
            {PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
          <input name="channelId" placeholder={t("channelIdField")} required className={inputClass} />
          <input name="url" type="url" placeholder={t("channelUrl")} required className={inputClass} />
          <input name="evidenceUrl" type="url" placeholder={t("evidence")} required className={inputClass} />
          <button type="submit" className={primaryClass}>{t("addChannel")}</button>
        </form>

        {channels.length === 0 ? (
          <EmptyState message={t("noChannels")} />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>ค่าย</th>
                  <th className={thClass}>แพลตฟอร์ม</th>
                  <th className={thClass}>รหัสช่อง</th>
                  <th className={thClass}>ลิงก์</th>
                  <th className={thClass}>สถานะ</th>
                  <th className={thClass}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((item) => (
                  <tr key={item.id}>
                    <td className={tdClass}>{item.studioName}</td>
                    <td className={tdClass}>{item.platform}</td>
                    <td className={tdClass}>{item.channelId}</td>
                    <td className={`${tdClass} max-w-xs break-all text-xs`}>
                      <a href={item.url} rel="noopener noreferrer" target="_blank" className="underline-offset-4 hover:underline">
                        {item.url}
                      </a>
                      <br />
                      <a href={item.evidenceUrl} rel="noopener noreferrer" target="_blank" className="text-muted underline-offset-4 hover:underline">
                        {t("evidence")}
                      </a>
                    </td>
                    <td className={tdClass}>
                      <Badge tone={item.status === "approved" ? "accent" : "neutral"}>{t(item.status)}</Badge>
                    </td>
                    <td className={tdClass}>
                      <form action={setChannelApproval}>
                        <input type="hidden" name="channelId" value={item.id} />
                        <input type="hidden" name="decision" value={item.status === "approved" ? "revoke" : "approve"} />
                        <button type="submit" className={buttonClass}>
                          {item.status === "approved" ? t("revoke") : t("approve")}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <AdminCard id="studio-links" title={t("linkTitle")} description="เชื่อมเรื่องกับค่ายตามบทบาท ใช้ slug ของเรื่องจากหน้าเรื่อง">
        <form action={linkStudioAnime} className="grid gap-2 md:grid-cols-4">
          <input name="studioSlug" placeholder={t("studioSlug")} required className={inputClass} />
          <input name="animeSlug" placeholder={t("animeSlug")} required className={inputClass} />
          <select name="role" defaultValue="produce" aria-label={t("roleField")} className={selectClass}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`roles.${role}`)}
              </option>
            ))}
          </select>
          <button type="submit" className={primaryClass}>{t("link")}</button>
        </form>

        {links.length === 0 ? (
          <EmptyState message={t("noWorks")} />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>ค่าย</th>
                  <th className={thClass}>เรื่อง</th>
                  <th className={thClass}>บทบาท</th>
                  <th className={thClass}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {links.map((item) => (
                  <tr key={`${item.studioSlug}-${item.animeSlug}-${item.role}`}>
                    <td className={tdClass}>{item.studioName}</td>
                    <td className={tdClass}>
                      <a href={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/th/anime/${item.animeSlug}`} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                        {item.titleRomaji}
                      </a>
                    </td>
                    <td className={tdClass}>{t(`roles.${item.role}`)}</td>
                    <td className={tdClass}>
                      <form action={deleteStudioLink}>
                        <input type="hidden" name="studioSlug" value={item.studioSlug} />
                        <input type="hidden" name="animeSlug" value={item.animeSlug} />
                        <input type="hidden" name="role" value={item.role} />
                        <button type="submit" className={buttonClass}>{t("unlink")}</button>
                      </form>
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
