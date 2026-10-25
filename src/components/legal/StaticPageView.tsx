import { getTranslations } from "next-intl/server";
import { STATIC_PAGES, type StaticPageKey } from "@/content/pages";

// Renders one static page in the viewer's language, falling back to English.
export async function StaticPageView({ page, locale }: { page: StaticPageKey; locale: string }) {
  const t = await getTranslations("legal");
  const translations = STATIC_PAGES[page];
  const content = translations[locale as "th" | "en" | "ja"] ?? translations.en;
  const isDraft = page !== "about";

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold text-ink">{content.title}</h1>
      {isDraft && <p className="rounded-md bg-raised p-3 text-sm text-muted">{t("draft")}</p>}
      {content.body.map((paragraph) => (
        <p key={paragraph} className="leading-relaxed text-ink">
          {paragraph}
        </p>
      ))}
    </article>
  );
}
