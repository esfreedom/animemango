"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { saveLocalePreference } from "@/actions/prefs";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("locale");
  const pathname = usePathname();
  const router = useRouter();

  return (
    <select
      aria-label={t("label")}
      value={locale}
      onChange={(event) => {
        const next = event.target.value as Locale;
        // Signed-in users keep the language in their profile. Guests keep it in the cookie next-intl sets.
        void saveLocalePreference(next);
        router.replace(pathname, { locale: next });
      }}
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
