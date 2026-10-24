import { getTranslations } from "next-intl/server";

// Legal pages are not built yet (they come with the community phase), so the
// links render as disabled until their routes exist.
const legalKeys = ["about", "terms", "privacy", "report"] as const;

export async function SiteFooter() {
  const t = await getTranslations("footer");

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 pb-24 text-sm text-muted md:flex-row md:items-center md:justify-between md:px-6 md:pb-8">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {legalKeys.map((key) => (
            <li key={key} className="text-muted/60">
              {t(key)}
            </li>
          ))}
        </ul>
        <p className="max-w-xl text-xs leading-relaxed">{t("copyright")}</p>
      </div>
    </footer>
  );
}
