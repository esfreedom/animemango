import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CommentSection } from "@/components/threads/CommentSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { getEpisodeDetail } from "@/data/catalog";
import { preparePage } from "@/lib/page";
import { resolveTitle } from "@/lib/titles";
import { formatAirTime } from "@/lib/time";

type Props = PageProps<"/[locale]/anime/[slug]/ep/[number]">;

function parseNumber(value: string): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number < 10000 ? number : null;
}

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug, number } = await params;
  await connection();
  const episodeNumber = parseNumber(number);
  const data = episodeNumber ? await getEpisodeDetail(slug, episodeNumber) : null;
  if (!data) return { title: "404" };

  const title = resolveTitle(data.titles, locale, data.anime.titleRomaji).title;
  return {
    title: `${title} ${episodeNumber}`,
    alternates: { canonical: `/${locale}/anime/${slug}/ep/${episodeNumber}` },
  };
}

export default async function EpisodePage({ params, searchParams }: Props) {
  const locale = await preparePage(params);
  const { slug, number } = await params;
  const query = await searchParams;
  const episodeNumber = parseNumber(number);
  if (!episodeNumber) notFound();

  const data = await getEpisodeDetail(slug, episodeNumber);
  if (!data) notFound();

  const t = await getTranslations("episode");
  const tStatus = await getTranslations("status");
  const tComments = await getTranslations("comments");
  const title = resolveTitle(data.titles, locale, data.anime.titleRomaji);
  const lang = typeof query.lang === "string" ? query.lang : undefined;

  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <Link href={`/anime/${data.anime.slug}`} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          ← {t("backToAnime")}
        </Link>
        <p className="text-sm text-muted">{title.title}</p>
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{t("title", { number: episodeNumber })}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <Badge>{tStatus(data.episode.status as "scheduled" | "aired" | "delayed")}</Badge>
          <span>
            {t("airsAt")}:{" "}
            {data.episode.airAtUtc ? formatAirTime(data.episode.airAtUtc, locale, "Asia/Bangkok") : t("noTime")}
          </span>
        </div>
      </header>

      <Section id="schedule-history" title={t("scheduleHistory")}>
        {data.schedule.length === 0 ? (
          <EmptyState message={t("scheduleHistoryEmpty")} />
        ) : (
          <ul className="space-y-2 text-sm text-muted">
            {data.schedule.map((entry) => (
              <li key={entry.id}>
                {t("moved", {
                  from: entry.oldAirAtUtc ? formatAirTime(entry.oldAirAtUtc, locale, "Asia/Bangkok") : t("noTime"),
                  to: entry.newAirAtUtc ? formatAirTime(entry.newAirAtUtc, locale, "Asia/Bangkok") : t("noTime"),
                })}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="episode-threads" title={tComments("title")}>
        {data.threadId ? (
          <CommentSection
            threadId={data.threadId}
            locale={locale}
            basePath={`/anime/${data.anime.slug}/ep/${episodeNumber}`}
            selectedLang={lang}
          />
        ) : (
          <EmptyState message={tComments("empty")} />
        )}
      </Section>
    </div>
  );
}
