import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { navItems } from "./nav";
import { ThemeToggle } from "./ThemeToggle";

export async function SiteHeader() {
  const t = await getTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 md:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-ink">
          AnimeHub
        </Link>

        <nav aria-label={t("label")} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => (
              <li key={item.key}>
                {item.ready ? (
                  <Link
                    href={item.href}
                    className="rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-raised hover:text-ink"
                  >
                    {t(item.key)}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted/60"
                  >
                    {t(item.key)}
                    <span className="rounded bg-raised px-1.5 text-[10px] text-muted">
                      {t("soon")}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
