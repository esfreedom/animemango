import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getThreadComments, getThreadLanguageCounts } from "@/data/community";
import { formatAirTime } from "@/lib/time";
import { isCommentLang, type CommentLang } from "@/lib/lang";
import { getCurrentUser } from "@/lib/session";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CommentForm } from "./CommentForm";
import { ReportButton } from "./ReportButton";

type CommentSectionProps = {
  threadId: string;
  locale: string;
  // Path of the page that hosts the thread, used to build language filter links.
  basePath: string;
  selectedLang?: string;
};

type Row = Awaited<ReturnType<typeof getThreadComments>>[number];

export async function CommentSection({ threadId, locale, basePath, selectedLang }: CommentSectionProps) {
  const t = await getTranslations("comments");
  const tLang = await getTranslations("lang");
  const lang: CommentLang | undefined = isCommentLang(selectedLang) ? selectedLang : undefined;

  const [comments, counts, user] = await Promise.all([
    getThreadComments(threadId, lang),
    getThreadLanguageCounts(threadId),
    getCurrentUser(),
  ]);

  const roots = comments.filter((row) => !row.parentId);
  const repliesFor = (id: string) => comments.filter((row) => row.parentId === id);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const filters: { code: string; label: string; href: string; count: number }[] = [
    { code: "", label: t("all"), href: basePath, count: total },
    ...(["th", "en", "ja", "other"] as const).map((code) => ({
      code,
      label: tLang(code),
      href: `${basePath}?lang=${code}`,
      count: counts[code] ?? 0,
    })),
  ];

  return (
    <div className="space-y-6">
      <nav aria-label={t("filter")}>
        <ul className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const active = (filter.code || undefined) === lang;
            return (
              <li key={filter.code || "all"}>
                <Link
                  href={filter.href}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                    active ? "border-accent text-ink" : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {filter.label}
                  <span className="text-muted">{filter.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {user ? (
        <CommentForm threadId={threadId} />
      ) : (
        <p className="text-sm text-muted">
          <Link href="/login" className="text-ink underline underline-offset-4">
            {t("signInToComment")}
          </Link>
        </p>
      )}

      {roots.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <ol className="space-y-4">
          {roots.map((row) => (
            <CommentItem key={row.id} row={row} locale={locale} signedIn={Boolean(user)} threadId={threadId} repliesFor={repliesFor} />
          ))}
        </ol>
      )}
    </div>
  );
}

async function CommentItem({
  row,
  locale,
  signedIn,
  threadId,
  repliesFor,
}: {
  row: Row;
  locale: string;
  signedIn: boolean;
  threadId: string;
  repliesFor: (id: string) => Row[];
}) {
  const t = await getTranslations("comments");
  const tLang = await getTranslations("lang");
  const replies = repliesFor(row.id);

  return (
    <li className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <header className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link href={`/u/${row.username}`} className="font-semibold text-ink">
          {row.username}
        </Link>
        <Badge>{tLang(row.lang as "th" | "en" | "ja" | "other")}</Badge>
        <time dateTime={row.createdAt.toISOString()}>
          {formatAirTime(row.createdAt, locale, "Asia/Bangkok")}
        </time>
      </header>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{row.body}</p>
      <footer className="flex flex-wrap items-center gap-4">
        {signedIn && <ReportButton commentId={row.id} />}
      </footer>

      {replies.length > 0 && (
        <ol className="space-y-3 border-l border-line pl-4">
          {replies.map((reply) => (
            <li key={reply.id} className="space-y-1">
              <header className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <Link href={`/u/${reply.username}`} className="font-semibold text-ink">
                  {reply.username}
                </Link>
                <Badge>{tLang(reply.lang as "th" | "en" | "ja" | "other")}</Badge>
                <time dateTime={reply.createdAt.toISOString()}>
                  {formatAirTime(reply.createdAt, locale, "Asia/Bangkok")}
                </time>
              </header>
              <p className="whitespace-pre-wrap break-words text-sm text-ink">{reply.body}</p>
            </li>
          ))}
        </ol>
      )}

      {signedIn && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-ink">{t("reply")}</summary>
          <div className="mt-2">
            <CommentForm threadId={threadId} parentId={row.id} compact />
          </div>
        </details>
      )}
    </li>
  );
}
