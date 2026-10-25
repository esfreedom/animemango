import { getTranslations } from "next-intl/server";
import { PosterCard } from "./PosterCard";
import { LangTags } from "./LangTags";
import { Badge } from "@/components/ui/Badge";
import { cornerBadgeFor, type FeedEntry } from "@/data/feed";
import { resolveLatestAired } from "@/lib/badge";
import { matchPrefs, type Prefs } from "@/lib/prefs";
import { resolveTitle } from "@/lib/titles";
import { formatAirTime } from "@/lib/time";

type EntryCardProps = {
  entry: FeedEntry;
  locale: string;
  now: Date;
  // "updated" shows the last aired episode, "upcoming" shows the next one.
  mode: "updated" | "upcoming";
  prefs: Prefs;
  priority?: boolean;
};

// One card per entry (season or movie). Episodes never get their own card on the home page.
export async function EntryCard({ entry, locale, now, mode, prefs, priority = false }: EntryCardProps) {
  const t = await getTranslations("episode");
  const tAvailability = await getTranslations("availability");

  const title = resolveTitle(entry.titles, locale, entry.titleRomaji).title;
  const displayTitle =
    entry.entryKind === "tv" && entry.seriesTitle
      ? entry.seasonLabel
        ? `${entry.seriesTitle} ${entry.seasonLabel}`
        : entry.seriesTitle
      : title;

  const badge = cornerBadgeFor(entry, now);
  const corner =
    badge.kind === "end" ? (
      <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold leading-none text-on-accent">END</span>
    ) : badge.kind === "ep" ? (
      <span className="rounded bg-canvas/90 px-1.5 py-0.5 text-[11px] font-bold leading-none text-ink">EP {badge.number}</span>
    ) : null;

  const latest = resolveLatestAired(entry.latestAiredStored, entry.episodes, now);
  const when =
    mode === "updated"
      ? entry.lastAiredAt && latest !== null
        ? `${t("title", { number: latest })} · ${formatAirTime(entry.lastAiredAt, locale, "Asia/Bangkok")}`
        : null
      : entry.nextAirAt && entry.nextEpisode
        ? `${t("title", { number: entry.nextEpisode })} · ${formatAirTime(entry.nextAirAt, locale, "Asia/Bangkok")}`
        : null;

  // Platforms that match the viewer's audio or subtitle choice come first and are highlighted.
  const score = (platform: (typeof entry.platforms)[number]) => {
    const match = matchPrefs(platform, prefs);
    return Number(match.audio) + Number(match.sub);
  };
  const platforms = [...entry.platforms].sort((a, b) => score(b) - score(a)).slice(0, 3);

  return (
    <PosterCard
      href={`/anime/${entry.slug}`}
      title={displayTitle}
      coverUrl={entry.coverUrl}
      priority={priority}
      corner={corner}
      meta={when ?? undefined}
      tags={
        platforms.length > 0 ? (
          <ul className="space-y-1" aria-label={tAvailability("title")}>
            {platforms.map((platform) => (
              <li key={platform.platformName} className="flex flex-wrap items-center gap-1">
                <Badge tone={score(platform) > 0 ? "accent" : "neutral"}>{platform.platformName}</Badge>
                <LangTags audio={platform.audioLangs} subs={platform.subLangs} />
              </li>
            ))}
          </ul>
        ) : undefined
      }
    />
  );
}
