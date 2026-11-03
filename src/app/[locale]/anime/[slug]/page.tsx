import type { Metadata } from "next";
import Image from "next/image";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { toggleFollow, toggleVote } from "@/actions/community";
import { LangTags } from "@/components/anime/LangTags";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { CommentSection } from "@/components/threads/CommentSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { AdSlot } from "@/components/ads/AdSlot";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getAnimeBySlug, getAvailabilityForAnime } from "@/data/catalog";
import { getAnimeVoteState, getFollowerCount } from "@/data/community";
import { offersFor } from "@/content/affiliate";
import { preparePage, requestNow, SITE_NAME } from "@/lib/page";
import { getCurrentUser } from "@/lib/session";
import { hasThaiContent, resolveSynopsis, resolveTitle } from "@/lib/titles";
import { formatAirTime } from "@/lib/time";
import { translateValue } from "@/lib/labels";
import { resolveTitleSource } from "@/lib/titles";
import { slugify } from "@/lib/slug";

type Props = PageProps<"/[locale]/anime/[slug]">;

// Availability older than this is flagged as unconfirmed (DESIGN.md section 7).
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await connection();

  const data = await getAnimeBySlug(slug);
  if (!data) return { title: "404" };

  const title = resolveTitle(data.titles, locale, data.anime.titleRomaji).title;
  const synopsis = resolveSynopsis(data.titles, locale)?.synopsis;
  const tGenre = await getTranslations({ locale, namespace: "genre" });
  const genres = data.anime.genres.map((genre) => translateValue(tGenre, genre)).join(", ");
  const description = synopsis ?? `${title}: ${data.anime.episodeCount ?? ""} ${genres}`.trim();

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/anime/${slug}`,
      languages: Object.fromEntries([
        ...routing.locales.map((code) => [code, `/${code}/anime/${slug}`]),
        ["x-default", `/${routing.defaultLocale}/anime/${slug}`],
      ]),
    },
    // Pages without Thai content stay out of the index until a Thai title exists (DESIGN.md section 10).
    robots: hasThaiContent(data.titles) ? undefined : { index: false, follow: true },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      images: data.anime.coverUrl ? [data.anime.coverUrl] : undefined,
    },
  };
}

export default async function AnimePage({ params, searchParams }: Props) {
  const locale = await preparePage(params);
  const { slug } = await params;
  const query = await searchParams;
  const lang = typeof query.lang === "string" ? query.lang : undefined;

  const data = await getAnimeBySlug(slug);
  if (!data) notFound();

  const { anime: row, series: parent, titles, episodes, trailers, seasons, threadId } = data;

  const [availability, user, followers] = await Promise.all([
    getAvailabilityForAnime(row.id),
    getCurrentUser(),
    getFollowerCount(row.id),
  ]);
  const voteState = await getAnimeVoteState(row.id, user?.id ?? null);
  const nowMs = await requestNow();

  const t = await getTranslations("anime");
  const tStatus = await getTranslations("status");
  const tCommon = await getTranslations("common");
  const tAvailability = await getTranslations("availability");
  const tEpisode = await getTranslations("episode");
  const tLang = await getTranslations("lang");
  const tComments = await getTranslations("comments");
  const tSeries = await getTranslations("series");
  const tGenre = await getTranslations("genre");
  const tFormat = await getTranslations("format");
  const tSeasonName = await getTranslations("season");
  const tAds = await getTranslations("ads");

  const title = resolveTitle(titles, locale, row.titleRomaji);
  const titleSource = resolveTitleSource(titles, locale);
  const synopsis = resolveSynopsis(titles, locale);
  const shop = offersFor(row.slug);
  const season = seasons[0];
  const platformSlug = (name: string) => slugify(name);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: title.title,
    alternateName: row.titleRomaji,
    url: `/${locale}/anime/${row.slug}`,
    image: row.coverUrl ?? undefined,
    numberOfEpisodes: row.episodeCount ?? undefined,
    genre: row.genres,
    startDate: row.startDate ?? undefined,
    inLanguage: locale,
  };

  return (
    <div className="space-y-12">
      <JsonLd data={jsonLd} />

      <header className="grid gap-6 md:grid-cols-[220px_1fr] md:gap-10">
        <div className="relative mx-auto aspect-[2/3] w-44 overflow-hidden rounded-lg border border-line bg-raised md:w-full">
          {row.coverUrl ? (
            <Image src={row.coverUrl} alt={title.title} fill sizes="220px" className="object-cover" priority />
          ) : (
            <span className="flex h-full items-center justify-center p-3 text-center text-sm text-muted">{title.title}</span>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{tStatus(row.status as "upcoming" | "airing" | "finished" | "hiatus")}</Badge>
            {title.isFallback && <Badge>{tLang("fallback")}</Badge>}
          </div>
          <h1 className="text-3xl font-bold text-ink md:text-4xl">{title.title}</h1>
          {parent && (
            <Link href={`/series/${parent.slug}`} className="inline-block text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
              {tSeries("title", { title: parent.titleRomaji })}
            </Link>
          )}
          {title.isFallback && <p className="text-sm text-muted">{row.titleRomaji}</p>}
          {titleSource && (
            <p className="text-xs text-muted">
              {t("titleSource")}{" "}
              <a href={titleSource} rel="noopener noreferrer" target="_blank" className="underline-offset-4 hover:underline">
                {new URL(titleSource).hostname}
              </a>
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {row.format && <Meta label={t("format")} value={translateValue(tFormat, row.format)} />}
            {row.episodeCount && <Meta label={t("episodes")} value={String(row.episodeCount)} />}
            {row.averageScore && <Meta label={t("score")} value={`${row.averageScore}%`} />}
            {row.startDate && <Meta label={t("startDate")} value={row.startDate} />}
            {season && <Meta label={t("season")} value={`${tSeasonName(season.season)} ${season.year}`} />}
            {row.genres.length > 0 && (
              <Meta label={t("genres")} value={row.genres.map((genre) => translateValue(tGenre, genre)).join(", ")} />
            )}
          </dl>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <VoteFollowControls
              animeId={row.id}
              signedIn={Boolean(user)}
              voted={voteState.voted}
              following={voteState.following}
              labels={{
                vote: t("vote"),
                unvote: t("unvote"),
                follow: t("follow"),
                unfollow: t("unfollow"),
                votes: t("votes", { count: voteState.votes }),
                followers: t("followers", { count: followers }),
                signIn: tCommon("signInFirst"),
              }}
            />
            <Link href={`/anime/${row.slug}/watch-order`} className="rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-raised">
              {t("watchOrder")}
            </Link>
          </div>
        </div>
      </header>

      <Section id="synopsis" title={t("synopsis")}>
        <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink">
          {synopsis ? synopsis.synopsis : t("noSynopsis")}
        </p>
        {synopsis?.isFallback && <p className="text-xs text-muted">{tLang("fallback")}</p>}
      </Section>

      <Section id="availability" title={tAvailability("title")}>
        {availability.current.length === 0 ? (
          <EmptyState message={tAvailability("none")} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {availability.current.map((item) => (
              <li key={item.id} className="space-y-2 rounded-lg border border-line bg-surface p-4">
                <p className="font-medium text-ink">
                  <Link href={`/where-to-watch/${platformSlug(item.platformName)}`} className="underline-offset-4 hover:underline">
                    {item.platformName}
                  </Link>
                </p>
                <LangTags audio={item.audioLangs} subs={item.subLangs} />
                <p className="text-xs text-muted">
                  {tAvailability("verifiedAt", { date: formatAirTime(item.verifiedAt, locale, "Asia/Bangkok") })}
                </p>
                {nowMs - item.verifiedAt.getTime() > STALE_AFTER_MS && (
                  <p className="text-xs text-accent">{tAvailability("stale")}</p>
                )}
                <a
                  href={item.platformUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-ink underline-offset-4 hover:underline"
                >
                  {tAvailability("visit")}
                </a>
              </li>
            ))}
          </ul>
        )}

        <details className="rounded-lg border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm text-ink">{tAvailability("history")}</summary>
          {availability.history.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{tAvailability("historyEmpty")}</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {availability.history.map((item, index) => (
                <li key={index} className="flex flex-wrap items-center gap-2">
                  <span className="text-ink">{tAvailability(item.event)}</span>
                  <span>{item.platformName}</span>
                  <span>{formatAirTime(item.occurredAt, locale, "Asia/Bangkok")}</span>
                  <LangTags audio={item.audioLangs} subs={item.subLangs} />
                </li>
              ))}
            </ul>
          )}
        </details>
      </Section>

      <Section id="trailers" title={t("trailers")}>
        {trailers.length === 0 ? (
          <EmptyState message={t("noTrailers")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {trailers.map((item) => (
              <div key={item.id} className="aspect-video overflow-hidden rounded-lg border border-line bg-raised">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}`}
                  title={`${title.title} trailer`}
                  loading="lazy"
                  allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section id="episodes" title={t("episodeList")}>
        {episodes.length === 0 ? (
          <EmptyState message={t("noEpisodes")} />
        ) : (
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {episodes.map((item) => (
              <li key={item.number}>
                <Link
                  href={`/anime/${row.slug}/ep/${item.number}`}
                  className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-sm hover:bg-raised"
                >
                  <span className="text-ink">{tEpisode("title", { number: item.number })}</span>
                  <span className="text-xs text-muted">
                    {item.airAtUtc ? formatAirTime(item.airAtUtc, locale, "Asia/Bangkok") : tEpisode("noTime")}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {shop.length > 0 && (
        <Section id="shop" title={t("shop")}>
          <ul className="grid gap-3 md:grid-cols-3">
            {shop.map((offer) => (
              <li key={offer.url}>
                <a href={offer.url} rel="sponsored nofollow noopener noreferrer" target="_blank" className="block rounded-lg border border-line bg-surface p-4 text-sm text-ink hover:bg-raised">
                  {offer.title}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t("shopDisclosure")}</p>
        </Section>
      )}

      <AdSlot label={tAds("label")} consent={false} />

      <Section id="threads" title={tComments("title")}>
        {threadId ? (
          <CommentSection threadId={threadId} locale={locale} basePath={`/anime/${row.slug}`} selectedLang={lang} />
        ) : (
          <EmptyState message={tCommon("notAvailable")} />
        )}
      </Section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

// Plain forms that call server actions. They work without JavaScript.
function VoteFollowControls({
  animeId,
  signedIn,
  voted,
  following,
  labels,
}: {
  animeId: string;
  signedIn: boolean;
  voted: boolean;
  following: boolean;
  labels: Record<"vote" | "unvote" | "follow" | "unfollow" | "votes" | "followers" | "signIn", string>;
}) {
  if (!signedIn) {
    return (
      <p className="text-sm text-muted">
        <Link href="/login" className="text-ink underline underline-offset-4">
          {labels.signIn}
        </Link>
      </p>
    );
  }

  return (
    <>
      <form action={toggleVote}>
        <input type="hidden" name="animeId" value={animeId} />
        <button type="submit" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-on-accent">
          {voted ? labels.unvote : labels.vote}
        </button>
        <span className="ml-2 text-xs text-muted">{labels.votes}</span>
      </form>
      <form action={toggleFollow}>
        <input type="hidden" name="animeId" value={animeId} />
        <button type="submit" className="rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-raised">
          {following ? labels.unfollow : labels.follow}
        </button>
        <span className="ml-2 text-xs text-muted">{labels.followers}</span>
      </form>
    </>
  );
}

