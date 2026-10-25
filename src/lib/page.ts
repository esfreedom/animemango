import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { routing } from "@/i18n/routing";

// Common start for pages that read data. The request is awaited first, so pages
// render per request and nothing runs at build time. Unknown locales return 404.
export async function preparePage(params: Promise<{ locale: string }>): Promise<string> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await connection();
  return locale;
}

export const SITE_NAME = "AnimeHub";

// Current time for the request. Pages use this instead of Date.now() during render.
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}
