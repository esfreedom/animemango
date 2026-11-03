import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LangTags } from "./LangTags";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { cornerBadgeFor, type SeriesHomeCard } from "@/data/feed";
import { matchPrefs, type Prefs } from "@/lib/prefs";
import { resolveTitle } from "@/lib/titles";
import { formatAirTime } from "@/lib/time";

type SeriesCardProps = {
  card: SeriesHomeCard;
  locale: string;
  now: Date;
  prefs: Prefs;
  priority?: boolean;
};

// One card per series. It shows the cover, the corner badge, the latest episodes, the next
// episode, the platforms and the studios. Seasons and movies of the same series share the card.
export async function SeriesCard({ card, locale, now, prefs, priority = false }: SeriesCardProps) {
  const t = await getTranslations("home");
  const tEpisode = await getTranslations("episode");
  const tAvailability = await getTranslations("availability");

  const primary = card.primary;
  const title = primary.seriesTitle ?? resolveTitle(primary.titles, locale, primary.titleRomaji).title;
  const href = primary.seriesSlug ? `/series/${primary.seriesSlug}` : `/anime/${primary.slug}`;
  const multiple = card.members.length > 1;

  const badge = cornerBadgeFor(primary, now);
  const corner =
    badge.kind === "end" ? (
      <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold leading-none text-on-accent">END</span>
    ) : badge.kind === "ep" ? (
      <span className="rounded bg-canvas/90 px-1.5 py-0.5 text-[11px] font-bold leading-none text-ink">EP {badge.number}</span>
    ) : null;

  // Platforms from every season, without repeats. The ones that match the viewer's choice come first.
  const score = (platform: (typeof primary.platforms)[number]) => {
    const match = matchPrefs(platform, prefs);
    return Number(match.audio) + Number(match.sub);
  };
  const seen = new Set<string>();
  const platforms = card.members
    .flatMap((member) => member.platforms)
    .filter((platform) => {
      if (seen.has(platform.platformName)) return false;
      seen.add(platform.platformName);
      return true;
    })
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3);

  return (
    <article className="space-y-2">
      <Link href={href} className="group block space-y-2">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-line bg-raised transition-transform group-hover:-translate-y-0.5">
          {primary.coverUrl ? (
            <Image
              src={primary.coverUrl}
              alt={title}
              fill
              sizes="(min-width: 768px) 16vw, 33vw"
              className="object-cover"
              priority={priority}
            />
          ) : (
            <span className="flex h-full items-center justify-center p-3 text-center text-xs text-muted">{title}</span>
          )}
          {card.isNew && (
            <span className="absolute left-1.5 top-1.5 z-10 rounded bg-accent px-1.5 py-0.5 text-[11px] font-bold leading-none text-on-accent">
              {t("newBadge")}
            </span>
          )}
          {corner && <span className="absolute right-1.5 top-1.5 z-10">{corner}</span>}
        </div>
        <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{title}</p>
      </Link>

      {primary.seasonLabel && <p className="text-xs text-muted">{primary.seasonLabel}</p>}

      {card.nextAirAt && card.nextEpisode !== null && (
        <p className="text-xs text-muted">
          {t("nextEpisode")}: {tEpisode("title", { number: card.nextEpisode })} · {formatAirTime(card.nextAirAt, locale, "Asia/Bangkok")}
        </p>
      )}

      {card.recent.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted" aria-label={t("recent")}>
          {card.recent.map((item) => (
            <li key={`${item.member.slug}-${item.number}`}>
              {multiple && item.member.seasonLabel ? `${item.member.seasonLabel} · ` : ""}
              {tEpisode("title", { number: item.number })} · {formatAirTime(item.airedAt, locale, "Asia/Bangkok")}
            </li>
          ))}
        </ul>
      )}

      {platforms.length > 0 && (
        <ul className="space-y-1" aria-label={tAvailability("title")}>
          {platforms.map((platform) => (
            <li key={platform.platformName} className="flex flex-wrap items-center gap-1">
              <Badge tone={score(platform) > 0 ? "accent" : "neutral"}>{platform.platformName}</Badge>
              <LangTags audio={platform.audioLangs} subs={platform.subLangs} />
            </li>
          ))}
        </ul>
      )}

      {card.studios.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {card.studios.map((studio) => (
            <li key={studio.slug}>
              <Link href={`/studio/${studio.slug}`} className="text-muted underline-offset-4 hover:text-ink hover:underline">
                {studio.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
