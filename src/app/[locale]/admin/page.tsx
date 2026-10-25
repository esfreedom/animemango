import { getTranslations } from "next-intl/server";
import {
  addAnnouncement,
  addAvailability,
  addOfficialChannel,
  addPlatform,
  addTrailer,
  addWatchOrderEntry,
  approveProposal,
  endAvailability,
  rejectProposal,
  setTakedownStatus,
} from "@/actions/admin";
import { setCommentStatus } from "@/actions/comments";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { getPlatforms } from "@/data/catalog";
import { getRecentReports } from "@/data/community";
import {
  getActiveAvailability,
  getOfficialChannels,
  getOpenTakedowns,
  getPendingProposals,
} from "@/data/admin";
import { preparePage } from "@/lib/page";
import { canModerate, getCurrentUser, isAdmin } from "@/lib/session";

const inputClass = "h-9 rounded-md border border-line bg-canvas px-3 text-sm text-ink";
const buttonClass = "h-9 rounded-md border border-line px-3 text-sm text-ink hover:bg-raised";
const primaryClass = "h-9 rounded-md bg-accent px-3 text-sm font-semibold text-on-accent";

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

export default async function AdminPage({ params }: PageProps<"/[locale]/admin">) {
  await preparePage(params);
  const t = await getTranslations("admin");
  const user = await getCurrentUser();

  if (!canModerate(user)) {
    return <EmptyState message={t("forbidden")} />;
  }

  const admin = isAdmin(user);
  const reports = await getRecentReports();
  const openReports = reports.filter((item) => item.status !== "removed");

  return (
    <div className="space-y-12">
      <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>

      <Section id="reports" title={t("reports")}>
        {openReports.length === 0 ? (
          <EmptyState message={t("reportsEmpty")} />
        ) : (
          <ul className="space-y-3">
            {openReports.map((item) => (
              <li key={item.id} className="space-y-3 rounded-lg border border-line bg-surface p-4">
                <p className="whitespace-pre-wrap text-sm text-ink">{item.body}</p>
                <p className="text-xs text-muted">
                  {item.reason} · <Badge>{item.status}</Badge>
                </p>
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
              </li>
            ))}
          </ul>
        )}
      </Section>

      {admin && <AdminOnly />}
    </div>
  );
}

async function AdminOnly() {
  const t = await getTranslations("admin");
  const [proposals, takedowns, availability, channels, platforms] = await Promise.all([
    getPendingProposals(),
    getOpenTakedowns(),
    getActiveAvailability(),
    getOfficialChannels(),
    getPlatforms(),
  ]);

  return (
    <>
      <Section id="proposals" title={t("drafts")}>
        {proposals.length === 0 ? (
          <EmptyState message={t("draftsEmpty")} />
        ) : (
          <ul className="space-y-4">
            {proposals.map((item) => {
              const payload = item.payload as { titleTh?: string | null; synopsisTh?: string | null };
              const label = item.animeTitle ?? item.seriesTitle ?? "";
              return (
                <li key={item.id} className="space-y-3 rounded-lg border border-line bg-surface p-4">
                  <p className="text-sm text-muted">
                    {item.kind} · {label} · {item.aiModel} · {item.promptVersion}
                  </p>
                  {item.kind === "metadata" ? (
                    <form action={approveProposal} className="grid gap-2 md:grid-cols-2">
                      <input type="hidden" name="proposalId" value={item.id} />
                      <label className="flex flex-col gap-1 text-xs text-muted">
                        {t("titleField")}
                        <input name="titleTh" defaultValue={payload.titleTh ?? ""} className={inputClass} />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-muted">
                        {t("synopsisField")}
                        <textarea name="synopsisTh" defaultValue={payload.synopsisTh ?? ""} rows={3} className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink" />
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
      </Section>

      <Section id="takedowns" title={t("takedowns")}>
        {takedowns.length === 0 ? (
          <EmptyState message={t("takedownsEmpty")} />
        ) : (
          <ul className="space-y-3">
            {takedowns.map((item) => (
              <li key={item.id} className="space-y-2 rounded-lg border border-line bg-surface p-4 text-sm">
                <p className="text-ink">{item.url}</p>
                <p className="whitespace-pre-wrap text-muted">{item.reason}</p>
                <p className="text-xs text-muted">
                  {item.requesterName} · {item.requesterEmail}
                </p>
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
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="channels" title={t("channels")}>
        <ul className="space-y-1 text-sm text-muted">
          {channels.map((channel) => (
            <li key={channel.channelId}>
              {channel.name} ({channel.channelId})
            </li>
          ))}
        </ul>
        <form action={addOfficialChannel} className="grid gap-2 md:grid-cols-4">
          <input name="channelId" placeholder={t("channelId")} required className={inputClass} />
          <input name="name" placeholder={t("channelName")} required className={inputClass} />
          <input name="evidenceUrl" type="url" placeholder={t("evidenceUrl")} required className={inputClass} />
          <button type="submit" className={primaryClass}>{t("addChannel")}</button>
        </form>
      </Section>

      <Section id="trailers" title={t("trailers")}>
        <form action={addTrailer} className="grid gap-2 md:grid-cols-4">
          <input name="animeSlug" placeholder={t("animeSlug")} required className={inputClass} />
          <input name="youtubeId" placeholder={t("youtubeId")} required className={inputClass} />
          <input name="channelId" placeholder={t("channelId")} required className={inputClass} />
          <button type="submit" className={primaryClass}>{t("addTrailer")}</button>
        </form>
      </Section>

      <Section id="availability" title={t("availabilityTitle")}>
        <ul className="space-y-2 text-sm">
          {availability.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
              <span className="text-ink">
                {item.animeTitle} · {item.platformName} · {item.audioLangs.join(",")} / {item.subLangs.join(",")}
              </span>
              <form action={endAvailability}>
                <input type="hidden" name="availabilityId" value={item.id} />
                <button type="submit" className={buttonClass}>{t("endAvailability")}</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addAvailability} className="grid gap-2 md:grid-cols-3">
          <input name="animeSlug" placeholder={t("animeSlug")} required className={inputClass} />
          <input name="platformId" placeholder={t("platformId")} required className={inputClass} />
          <input name="region" placeholder={t("region")} defaultValue="TH" className={inputClass} />
          <input name="audioLangs" placeholder={t("audioLangs")} className={inputClass} />
          <input name="subLangs" placeholder={t("subLangs")} className={inputClass} />
          <input name="sourceUrl" type="url" placeholder={t("sourceUrl")} required className={inputClass} />
          <button type="submit" className={primaryClass}>{t("addAvailability")}</button>
        </form>
      </Section>

      <Section id="announcements-admin" title={t("announcements")}>
        <form action={addAnnouncement} className="grid gap-2 md:grid-cols-2">
          <input name="title" placeholder={t("headline")} required className={inputClass} />
          <input name="sourceName" placeholder={t("sourceName")} required className={inputClass} />
          <input name="sourceUrl" type="url" placeholder={t("sourceUrl")} required className={inputClass} />
          <input name="publishedAt" type="datetime-local" required className={inputClass} />
          <input name="summary" placeholder={t("summary")} className={inputClass} />
          <input name="animeSlug" placeholder={t("animeSlug")} className={inputClass} />
          <button type="submit" className={primaryClass}>{t("addAnnouncement")}</button>
        </form>
      </Section>

      <Section id="watch-order-admin" title={t("watchOrderTitle")}>
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
      </Section>

      <Section id="platforms-admin" title={t("platforms")}>
        <ul className="space-y-1 text-sm text-muted">
          {platforms.map((item) => (
            <li key={item.id}>
              {item.id} · {item.name} · {item.regions.join(",")}
            </li>
          ))}
        </ul>
        <form action={addPlatform} className="grid gap-2 md:grid-cols-3">
          <input name="name" placeholder={t("platformName")} required className={inputClass} />
          <input name="officialUrl" type="url" placeholder={t("officialUrl")} required className={inputClass} />
          <input name="regions" placeholder={t("region")} className={inputClass} />
          <button type="submit" className={primaryClass}>{t("addPlatform")}</button>
        </form>
      </Section>
    </>
  );
}
