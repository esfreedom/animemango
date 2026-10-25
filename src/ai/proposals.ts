import { z } from "zod";
import { validateDraftFields } from "./validator";
import type { ProposalKind } from "./policy";

// Payload shapes for each proposal kind. Every schema is strict, so an unexpected field
// (for example a stream URL) makes the proposal fail instead of being stored silently.

const LANG = z.enum(["ja", "en", "th"]);

export const availabilityPayload = z
  .object({
    platformName: z.string().trim().min(1).max(120),
    region: z.string().trim().min(2).max(5).default("TH"),
    audioLangs: z.array(LANG).max(3),
    subLangs: z.array(LANG).max(3),
    coversAllEpisodes: z.boolean(),
    episodeFrom: z.number().int().min(1).nullable(),
    episodeTo: z.number().int().min(1).nullable(),
    sourceUrl: z.url().max(2000),
  })
  .strict()
  .refine((value) => value.coversAllEpisodes || (value.episodeFrom !== null && value.episodeTo !== null), {
    message: "episodeFrom and episodeTo are required unless coversAllEpisodes is true",
  })
  .refine((value) => value.episodeFrom === null || value.episodeTo === null || value.episodeFrom <= value.episodeTo, {
    message: "episodeFrom must not be after episodeTo",
  });

export const announcementPayload = z
  .object({
    title: z.string().trim().min(3).max(200),
    summary: z.string().trim().max(500).optional(),
    sourceName: z.string().trim().min(2).max(120),
    sourceUrl: z.url().max(2000),
    publishedAt: z.iso.datetime(),
  })
  .strict();

// Grouping and season labels. Each entry names an anime by slug and says where it belongs.
export const structurePayload = z
  .object({
    entries: z
      .array(
        z
          .object({
            animeSlug: z.string().min(1).max(200),
            entryKind: z.enum(["tv", "movie", "ova", "special"]),
            seasonLabel: z.string().trim().max(20).nullable(),
            sortOrder: z.number().int().min(0).max(500),
          })
          .strict(),
      )
      .min(1)
      .max(40),
    seriesSlug: z.string().min(1).max(200).optional(),
  })
  .strict();

export type ParsedProposal = {
  payload: Record<string, unknown>;
  // URLs the proposal relies on. Each must pass the source allowlist.
  sourceUrls: string[];
};

export type ProposalParse = { ok: true; value: ParsedProposal } | { ok: false; errors: string[] };

export function parseProposalPayload(kind: ProposalKind, raw: unknown): ProposalParse {
  if (kind === "metadata") {
    const result = validateDraftFields(raw);
    return result.ok
      ? { ok: true, value: { payload: result.fields as Record<string, unknown>, sourceUrls: [] } }
      : { ok: false, errors: result.errors };
  }

  const schema = kind === "availability" ? availabilityPayload : kind === "announcement" ? announcementPayload : structurePayload;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`),
    };
  }

  const data = parsed.data as Record<string, unknown>;
  const sourceUrls = kind === "availability" || kind === "announcement" ? [String(data.sourceUrl)] : [];
  return { ok: true, value: { payload: data, sourceUrls } };
}
