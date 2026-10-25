import { z } from "zod";

// What the model may return. `.strict()` rejects any extra key, so a field such as
// "streamUrl" or "episodes" fails validation instead of reaching the database.
export const draftFieldsSchema = z
  .object({
    titleTh: z.string().trim().min(1).max(200).nullable(),
    synopsisTh: z.string().trim().min(1).max(600).nullable(),
    genresTh: z.array(z.string().trim().min(1).max(40)).max(12),
    unknownFields: z.array(z.string().max(60)).max(10),
  })
  .strict();

export type DraftFields = z.infer<typeof draftFieldsSchema>;

const LINK_PATTERN = /https?:\/\/|www\.|\.(com|net|org|tv|me|io)\b/i;

export type ValidationResult =
  | { ok: true; fields: DraftFields }
  | { ok: false; errors: string[] };

// Checks shape first, then text. Draft text may not contain links, because links
// must come from the reviewed source list, never from model output.
export function validateDraftFields(raw: unknown): ValidationResult {
  const parsed = draftFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`),
    };
  }

  const errors: string[] = [];
  const { titleTh, synopsisTh, genresTh } = parsed.data;
  const texts: [string, string | null][] = [
    ["titleTh", titleTh],
    ["synopsisTh", synopsisTh],
    ...genresTh.map((genre): [string, string] => ["genresTh", genre]),
  ];
  for (const [field, text] of texts) {
    if (text && LINK_PATTERN.test(text)) errors.push(`${field}: contains a link`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, fields: parsed.data };
}

export type DraftSource = { field: string; url: string };

// Every source must be an AniList page for the title being drafted. Nothing else is allowed.
export function validateSources(sources: DraftSource[], allowedUrls: Set<string>): string[] {
  return sources.flatMap((source) =>
    allowedUrls.has(source.url) ? [] : [`${source.field}: source ${source.url} is not allowed`],
  );
}
