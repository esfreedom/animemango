import { routing } from "@/i18n/routing";

// Canonical and hreflang alternates for one page, listed for every locale (DESIGN.md section 10).
// `path` is the page path without the locale, for example "/schedule". The home page uses "".
export function localeAlternates(locale: string, path: string) {
  return {
    canonical: `/${locale}${path}`,
    languages: Object.fromEntries([
      ...routing.locales.map((code) => [code, `/${code}${path}`]),
      ["x-default", `/${routing.defaultLocale}${path}`],
    ]),
  };
}
