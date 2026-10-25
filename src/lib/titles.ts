export type TitleRow = { locale: string; title: string; synopsis?: string | null; source: string };

export type ResolvedTitle = {
  title: string;
  // True when the title is not in the viewer's language. The UI labels these (DESIGN.md section 5).
  isFallback: boolean;
  locale: string;
};

// Picks the title for the viewer's locale, then English, then romaji.
export function resolveTitle(
  titles: TitleRow[],
  locale: string,
  romaji: string,
): ResolvedTitle {
  const exact = titles.find((row) => row.locale === locale);
  if (exact) return { title: exact.title, isFallback: false, locale };

  const english = titles.find((row) => row.locale === "en");
  if (english) return { title: english.title, isFallback: true, locale: "en" };

  return { title: romaji, isFallback: true, locale: "romaji" };
}

export function resolveSynopsis(titles: TitleRow[], locale: string) {
  const exact = titles.find((row) => row.locale === locale && row.synopsis);
  if (exact) return { synopsis: exact.synopsis!, isFallback: false };

  const english = titles.find((row) => row.locale === "en" && row.synopsis);
  if (english) return { synopsis: english.synopsis!, isFallback: true };

  return null;
}

// Thai pages are only indexed once a Thai title exists (DESIGN.md section 10).
export function hasThaiContent(titles: TitleRow[]): boolean {
  return titles.some((row) => row.locale === "th");
}
