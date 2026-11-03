// Translates a value from AniList (genre, format) when the dictionary has a label for it.
// Unknown values are shown as they came, so new AniList values never break a page.

type Translator = {
  (key: string): string;
  has: (key: string) => boolean;
};

// "Slice of Life" -> "slice_of_life", "Sci-Fi" -> "sci_fi", "TV_SHORT" -> "tv_short".
export function labelKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// The argument is a next-intl translator. Its typed signature does not accept plain strings,
// so the cast happens here once.
export function translateValue(translator: unknown, value: string): string {
  const t = translator as Translator;
  const key = labelKey(value);
  return t.has(key) ? t(key) : value;
}
