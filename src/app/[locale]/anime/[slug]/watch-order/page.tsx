import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/i18n/navigation";
import { getAnimeBySlug, getWatchOrder } from "@/data/catalog";
import { preparePage } from "@/lib/page";
import { resolveTitle } from "@/lib/titles";

export default async function WatchOrderPage({ params }: PageProps<"/[locale]/anime/[slug]/watch-order">) {
  const locale = await preparePage(params);
  const { slug } = await params;

  const data = await getAnimeBySlug(slug);
  if (!data) notFound();

  const t = await getTranslations("watchOrder");
  const title = resolveTitle(data.titles, locale, data.anime.titleRomaji);
  const entries = await getWatchOrder(data.anime.id);

  const visible = entries.filter((entry) => !entry.isSpoiler);
  const spoilers = entries.filter((entry) => entry.isSpoiler);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href={`/anime/${slug}`} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          ← {title.title}
        </Link>
        <h1 className="text-3xl font-bold text-ink">{t("title", { title: title.title })}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </header>

      {entries.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <>
          <ol className="space-y-3">
            {visible.map((entry) => (
              <WatchOrderItem key={`${entry.position}-${entry.relatedSlug}`} entry={entry} locale={locale} />
            ))}
          </ol>
          {spoilers.length > 0 && (
            <details className="rounded-lg border border-line bg-surface p-4">
              <summary className="cursor-pointer text-sm text-ink">{t("spoilerShow")}</summary>
              <ol className="mt-4 space-y-3">
                {spoilers.map((entry) => (
                  <WatchOrderItem key={`${entry.position}-${entry.relatedSlug}`} entry={entry} locale={locale} />
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </div>
  );
}

async function WatchOrderItem({
  entry,
  locale,
}: {
  entry: Awaited<ReturnType<typeof getWatchOrder>>[number];
  locale: string;
}) {
  const t = await getTranslations("watchOrder");
  const title = resolveTitle(entry.titles, locale, entry.relatedTitle);

  return (
    <li className="flex items-start gap-4 rounded-lg border border-line bg-surface p-4">
      <span className="w-8 shrink-0 text-right text-lg font-semibold text-muted">{entry.position}</span>
      <div className="min-w-0 space-y-1">
        <Link href={`/anime/${entry.relatedSlug}`} className="font-medium text-ink underline-offset-4 hover:underline">
          {title.title}
        </Link>
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{entry.relation}</span>
          {entry.isSpoiler && <Badge tone="accent">{t("spoilerNote")}</Badge>}
        </p>
        {entry.note && <p className="text-sm text-muted">{entry.note}</p>}
      </div>
    </li>
  );
}
