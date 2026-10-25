export const COMMENT_LANGS = ["th", "en", "ja", "other"] as const;
export type CommentLang = (typeof COMMENT_LANGS)[number];

// Lightweight script-based detection for comment tags (DESIGN.md section 5).
// It counts letters per script and picks the dominant one. Han characters count as
// Japanese, so Chinese-only text is tagged "ja" (a known limit). Users can override the tag.
export function detectLanguage(text: string): CommentLang {
  const counts = { th: 0, ja: 0, en: 0 };

  for (const char of text) {
    if (/\p{Script=Thai}/u.test(char)) counts.th++;
    else if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(char)) counts.ja++;
    else if (/\p{Script=Latin}/u.test(char)) counts.en++;
  }

  const total = counts.th + counts.ja + counts.en;
  if (total === 0) return "other";
  if (counts.th >= counts.ja && counts.th >= counts.en) return "th";
  if (counts.ja >= counts.en) return "ja";
  return "en";
}

export function isCommentLang(value: unknown): value is CommentLang {
  return typeof value === "string" && (COMMENT_LANGS as readonly string[]).includes(value);
}
