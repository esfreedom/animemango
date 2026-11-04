import { getTranslations } from "next-intl/server";
import { markNotificationsRead } from "@/actions/community";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/i18n/navigation";
import { listNotifications } from "@/data/community";
import { preparePage } from "@/lib/page";
import { getCurrentUser } from "@/lib/session";
import { formatAirTime } from "@/lib/time";

export default async function NotificationsPage({ params }: PageProps<"/[locale]/notifications">) {
  const locale = await preparePage(params);
  const t = await getTranslations("notifications");
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>
        <p className="text-sm text-muted">
          <Link href="/login" className="text-ink underline underline-offset-4">
            {t("signIn")}
          </Link>
        </p>
      </div>
    );
  }

  const items = await listNotifications(user.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>
        <form action={markNotificationsRead}>
          <button type="submit" className="rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-raised">
            {t("markAll")}
          </button>
        </form>
      </header>

      {items.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {items.map((item) => (
            <li key={item.id} className="space-y-1 p-4">
              <Link href={item.href} className="font-medium text-ink underline-offset-4 hover:underline">
                {item.title}
              </Link>
              <p className="text-sm text-muted">{item.body}</p>
              <p className="flex items-center gap-2 text-xs text-muted">
                {formatAirTime(item.createdAt, locale, "Asia/Bangkok")}
                {!item.readAt && <span className="font-semibold text-accent">{t("unread")}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
