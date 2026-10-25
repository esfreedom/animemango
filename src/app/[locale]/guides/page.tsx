import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GUIDES } from "@/content/guides";
import { preparePage } from "@/lib/page";

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

export default async function GuidesIndexPage({ params }: PageProps<"/[locale]/guides">) {
  const locale = await preparePage(params);
  const t = await getTranslations("guides");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>
      <ul className="grid gap-3 md:grid-cols-2">
        {GUIDES.map((guide) => {
          const content = guide.translations[locale as "th" | "en" | "ja"] ?? guide.translations.en;
          if (!content) return null;
          return (
            <li key={guide.slug}>
              <Link href={`/guides/${guide.slug}`} className="block rounded-lg border border-line bg-surface p-4 hover:bg-raised">
                <p className="font-medium text-ink">{content.title}</p>
                <p className="mt-1 text-sm text-muted">{content.intro}</p>
                <p className="mt-3 text-xs text-muted">{t("readMore")} →</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
