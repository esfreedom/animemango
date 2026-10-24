"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("locale");
  const pathname = usePathname();
  const router = useRouter();

  return (
    <select
      aria-label={t("label")}
      value={locale}
      onChange={(event) =>
        router.replace(pathname, { locale: event.target.value as Locale })
      }
      className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
    >
      {routing.locales.map((code) => (
        <option key={code} value={code}>
          {t(code)}
        </option>
      ))}
    </select>
  );
}
