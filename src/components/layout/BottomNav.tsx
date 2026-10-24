import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { navItems } from "./nav";

// Mobile-only navigation (DESIGN.md section 11). Hidden from md and up.
export async function BottomNav() {
  const t = await getTranslations("nav");

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {navItems.map((item) => (
          <li key={item.key}>
            {item.ready ? (
              <Link
                href={item.href}
                className="flex min-h-14 items-center justify-center px-2 text-center text-xs text-ink"
              >
                {t(item.key)}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="flex min-h-14 items-center justify-center px-2 text-center text-xs text-muted/60"
              >
                {t(item.key)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
