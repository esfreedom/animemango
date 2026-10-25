import { desc, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { aiDraft, anime } from "@/db/schema";
import { validateDraftFields, validateSources, type DraftSource } from "./validator";

export const PROMPT_VERSION = "2026-10-v1";

export type DraftInput = {
  titleRomaji: string;
  format: string | null;
  status: string;
  episodeCount: number | null;
  genres: string[];
  startDate: string | null;
};

// The model is behind an interface so tests can use a fake and the job can switch models.
export interface DraftModel {
  draft(input: DraftInput): Promise<unknown>;
}

export type PipelineResult = { created: number; rejected: number; failed: number };

type PipelineOptions = {
  db: Db;
  model: DraftModel;
  modelName: string;
  limit?: number;
};

// Drafts Thai titles and synopses for titles that have none yet. Results go to the
// review queue. Nothing is published here.
export async function runDraftPipeline({ db, model, modelName, limit = 5 }: PipelineOptions): Promise<PipelineResult> {
  const candidates = await db
    .select()
    .from(anime)
    .where(
      sql`not exists (
        select 1 from anime_i18n ai where ai.anime_id = ${anime.id} and ai.locale = 'th'
      ) and not exists (
        select 1 from ai_draft d where d.anime_id = ${anime.id}
      )`,
    )
    .orderBy(desc(anime.averageScore))
    .limit(limit);

  const result: PipelineResult = { created: 0, rejected: 0, failed: 0 };

  for (const row of candidates) {
    const sourceUrl = `https://anilist.co/anime/${row.anilistId}`;
    const sources: DraftSource[] = [
      { field: "titleTh", url: sourceUrl },
      { field: "synopsisTh", url: sourceUrl },
      { field: "genresTh", url: sourceUrl },
    ];

    let raw: unknown;
    try {
      raw = await model.draft({
        titleRomaji: row.titleRomaji,
        format: row.format,
        status: row.status,
        episodeCount: row.episodeCount,
        genres: row.genres,
        startDate: row.startDate,
      });
    } catch {
      result.failed++;
      continue;
    }

    const validation = validateDraftFields(raw);
    const sourceErrors = validateSources(sources, new Set([sourceUrl]));
    const errors = validation.ok ? sourceErrors : [...validation.errors, ...sourceErrors];

    await db.insert(aiDraft).values({
      animeId: row.id,
      fields: validation.ok ? validation.fields : { errors },
      sources,
      aiModel: modelName,
      promptVersion: PROMPT_VERSION,
      status: errors.length === 0 ? "draft" : "rejected",
    });

    if (errors.length === 0) result.created++;
    else result.rejected++;
  }

  return result;
}

