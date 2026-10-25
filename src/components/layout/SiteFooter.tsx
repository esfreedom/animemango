import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("footer");

  const links = [
    { key: "about", href: "/about" },
    { key: "terms", href: "/terms" },
    { key: "privacy", href: "/privacy" },
    { key: "report", href: "/report" },
  ] as const;

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 pb-24 text-sm text-muted md:flex-row md:items-center md:justify-between md:px-6 md:pb-8">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map((link) => (
            <li key={link.key}>
              <Link href={link.href} className="hover:text-ink">
                {t(link.key)}
              </Link>
            </li>
          ))}
        </ul>
        <div className="max-w-xl space-y-1 text-xs leading-relaxed">
          <p>{t("copyright")}</p>
          <p>{t("attribution")}</p>
        </div>
      </div>
    </footer>
  );
}
