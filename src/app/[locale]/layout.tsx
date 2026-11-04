import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, Noto_Sans_Thai } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { BottomNav } from "@/components/layout/BottomNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { routing } from "@/i18n/routing";
import { CONSENT_COOKIE, isGaMeasurementId, parseConsent } from "@/lib/consent";
import { themeScript } from "@/lib/theme";
import "../globals.css";

const latin = Inter({
  variable: "--font-latin",
  subsets: ["latin"],
  display: "swap",
});

const thai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai"],
  display: "swap",
});

// Noto Sans JP has no named subset in next/font, so the browser fetches glyph
// ranges on demand through unicode-range. preload stays off to keep the first load light.
const japanese = Noto_Sans_JP({
  variable: "--font-jp",
  display: "swap",
  preload: false,
});


// Pages read the database per request (see preparePage), so the locale tree is
// rendered at request time. Nothing that reads data runs during the build.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ),
    title: { default: t("title"), template: "%s | AnimeHub" },
    description: t("description"),
    // Google Search Console ownership token. Set NEXT_PUBLIC_GSC_VERIFICATION to the token from GSC.
    verification: process.env.NEXT_PUBLIC_GSC_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION }
      : undefined,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();
  const t = await getTranslations("nav");

  const consent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${latin.variable} ${thai.variable} ${japanese.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <NextIntlClientProvider messages={messages}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
          >
            {t("skip")}
          </a>
          <SiteHeader locale={locale} />
          <main
            id="main"
            className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-6 md:px-6 md:pb-12 md:pt-10"
          >
            {children}
          </main>
          <SiteFooter />
          <BottomNav />
          {consent === null && <ConsentBanner />}
          {consent === "accepted" && isGaMeasurementId(gaId) && <GoogleAnalytics id={gaId} />}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
