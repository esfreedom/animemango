import { getTranslations } from "next-intl/server";
import { signOut } from "@/actions/auth";
import { Link } from "@/i18n/navigation";
import { adminHomeUrl } from "@/lib/admin-host";
import { getCurrentUser, canModerate } from "@/lib/session";
import { getUnreadCountSafe } from "./unread";

const linkClass = "rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-raised hover:text-ink";

// Reads the session, so it renders inside a Suspense boundary in the header.
export async function AccountLinks({ locale }: { locale: string }) {
  const t = await getTranslations("nav");
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href="/login" className={linkClass}>
        {t("login")}
      </Link>
    );
  }

  const unread = await getUnreadCountSafe(user.id);
  // The back office is on its own host, so this is a plain link to that host.
  const adminUrl = adminHomeUrl(process.env.ADMIN_SITE_URL);

  return (
    <div className="flex items-center gap-1">
      <Link href="/notifications" className={linkClass}>
        {t("notifications")}
        {unread > 0 && (
          <span className="ml-1 rounded-full bg-accent px-1.5 text-xs text-on-accent">{unread}</span>
        )}
      </Link>
      <Link href={`/u/${user.username}`} className={`${linkClass} hidden sm:inline-block`}>
        {t("profile")}
      </Link>
      {canModerate(user) && adminUrl && (
        <a href={adminUrl} className={`${linkClass} hidden sm:inline-block`}>
          {t("admin")}
        </a>
      )}
      <form action={signOut}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className={linkClass}>
          {t("logout")}
        </button>
      </form>
    </div>
  );
}
