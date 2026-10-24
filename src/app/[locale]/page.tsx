import { getTranslations, setRequestLocale } from "next-intl/server";
import { PosterPlaceholder } from "@/components/media/PosterPlaceholder";

const sectionKeys = [
  "airingToday",
  "upcoming",
  "announcements",
  "availabilityChanges",
  "hotThreads",
] as const;

// Placeholder skeleton until the schedule and feed data exist (phase P2).
const PLACEHOLDER_COUNT = 6;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");

  return (
    <div className="flex flex-col gap-12">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-muted">{t("subtitle")}</p>
      </section>

      {sectionKeys.map((key) => (
        <section key={key} aria-labelledby={`section-${key}`} className="space-y-4">
          <h2 id={`section-${key}`} className="text-xl font-semibold text-ink">
            {t(`sections.${key}`)}
          </h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 md:gap-4">
            {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
              <li key={index}>
                <PosterPlaceholder label={t("empty")} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
