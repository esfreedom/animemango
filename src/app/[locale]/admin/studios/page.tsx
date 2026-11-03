import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  addStudioChannel,
  createStudio,
  deleteStudioLink,
  linkStudioAnime,
  setChannelApproval,
} from "@/actions/studios";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { listChannels, listStudioLinks, listStudios } from "@/data/studios";
import { preparePage } from "@/lib/page";
import { getCurrentUser, isAdmin } from "@/lib/session";

const inputClass = "h-9 rounded-md border border-line bg-canvas px-3 text-sm text-ink";
const buttonClass = "h-9 rounded-md border border-line px-3 text-sm text-ink hover:bg-raised";
const primaryClass = "h-9 rounded-md bg-accent px-3 text-sm font-semibold text-on-accent";

const KINDS = ["studio", "distributor", "platform", "rights_holder"] as const;
const ROLES = ["produce", "distribute", "licensor"] as const;
const PLATFORMS = ["youtube", "facebook", "x", "website"] as const;

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

export default async function AdminStudiosPage({ params }: PageProps<"/[locale]/admin/studios">) {
  await preparePage(params);
  const t = await getTranslations("studio");
  const tAdmin = await getTranslations("admin");
  const user = await getCurrentUser();

  if (!isAdmin(user)) {
    return <EmptyState message={tAdmin("forbidden")} />;
  }

  const [studios, channels, links] = await Promise.all([listStudios(), listChannels(), listStudioLinks()]);

  return (
    <div className="space-y-12">
      <Link href="/admin" className="text-sm text-muted underline-offset-4 hover:underline">
        {t("backToAdmin")}
      </Link>
      <h1 className="text-3xl font-bold text-ink">{t("adminTitle")}</h1>

      <Section id="studio-create" title={t("createTitle")}>
        {studios.length > 0 && (
          <ul className="flex flex-wrap gap-2 text-sm text-muted">
            {studios.map((item) => (
              <li key={item.id} className="rounded-md border border-line bg-surface px-3 py-1">
                {item.nameRomaji} <span className="text-xs">({item.slug})</span>
              </li>
            ))}
          </ul>
        )}
        <form action={createStudio} className="grid gap-2 md:grid-cols-4">
          <input name="nameRomaji" placeholder={t("name")} required className={inputClass} />
          <input name="slug" placeholder={t("slug")} required pattern="[a-z0-9\-]{2,80}" className={inputClass} />
          <select name="kind" defaultValue="studio" aria-label={t("kindField")} className={inputClass}>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`kind.${kind}`)}
              </option>
            ))}
          </select>
          <input name="websiteUrl" type="url" placeholder={t("website")} className={inputClass} />
          <button type="submit" className={primaryClass}>{t("create")}</button>
        </form>
      </Section>

      <Section id="studio-channels" title={t("channels")}>
        <form action={addStudioChannel} className="grid gap-2 md:grid-cols-3">
          <input name="studioSlug" placeholder={t("studioSlug")} required className={inputClass} />
          <select name="platform" defaultValue="youtube" aria-label={t("platformField")} className={inputClass}>
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
          <ul className="space-y-2 text-sm">
            {channels.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
                <span className="space-y-0.5">
                  <span className="block text-ink">
                    {item.studioName} · {item.platform} · {item.channelId}
                  </span>
                  <a href={item.url} rel="noopener noreferrer" target="_blank" className="block text-xs text-muted underline-offset-4 hover:underline">
                    {item.url}
                  </a>
                  <a href={item.evidenceUrl} rel="noopener noreferrer" target="_blank" className="block text-xs text-muted underline-offset-4 hover:underline">
                    {t("evidence")}
                  </a>
                </span>
                <span className="flex items-center gap-2">
                  <Badge>{t(item.status)}</Badge>
                  <form action={setChannelApproval}>
                    <input type="hidden" name="channelId" value={item.id} />
                    <input type="hidden" name="decision" value={item.status === "approved" ? "revoke" : "approve"} />
                    <button type="submit" className={buttonClass}>
                      {item.status === "approved" ? t("revoke") : t("approve")}
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="studio-links" title={t("linkTitle")}>
        <form action={linkStudioAnime} className="grid gap-2 md:grid-cols-4">
          <input name="studioSlug" placeholder={t("studioSlug")} required className={inputClass} />
          <input name="animeSlug" placeholder={t("animeSlug")} required className={inputClass} />
          <select name="role" defaultValue="produce" aria-label={t("roleField")} className={inputClass}>
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
          <ul className="space-y-2 text-sm">
            {links.map((item) => (
              <li key={`${item.studioSlug}-${item.animeSlug}-${item.role}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
                <span className="text-ink">
                  {item.studioName} · {item.titleRomaji} · {t(`roles.${item.role}`)}
                </span>
                <form action={deleteStudioLink}>
                  <input type="hidden" name="studioSlug" value={item.studioSlug} />
                  <input type="hidden" name="animeSlug" value={item.animeSlug} />
                  <input type="hidden" name="role" value={item.role} />
                  <button type="submit" className={buttonClass}>{t("unlink")}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
