import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { findGuide } from "@/content/guides";
import { localeAlternates } from "@/lib/alternates";
import { preparePage } from "@/lib/page";

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/guides/[slug]">) {
  const { locale, slug } = await params;
  return { alternates: localeAlternates(locale, `/guides/${slug}`) };
}

export default async function GuidePage({ params }: PageProps<"/[locale]/guides/[slug]">) {
  const locale = await preparePage(params);
  const { slug } = await params;

  const guide = findGuide(slug);
  if (!guide) notFound();

  const translation = guide.translations[locale as "th" | "en" | "ja"];
  const fallback = guide.translations.en;
  const content = translation ?? fallback;
  if (!content) notFound();

  const t = await getTranslations("guides");

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-muted">{t("updated", { date: guide.updated })}</p>
        <h1 className="text-3xl font-bold text-ink">{content.title}</h1>
        <p className="text-muted">{content.intro}</p>
        {!translation && <p className="rounded-md bg-raised p-3 text-sm text-muted">{t("notTranslated")}</p>}
      </header>
      {content.sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="text-xl font-semibold text-ink">{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="leading-relaxed text-ink">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
