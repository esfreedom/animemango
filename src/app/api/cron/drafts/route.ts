import { getDb } from "@/db/client";
import { createAnthropicDraftModel, DEFAULT_DRAFT_MODEL } from "@/ai/anthropic";
import { runDraftPipeline } from "@/ai/pipeline";

// Writes AI drafts into the review queue. Nothing is published by this route.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 503 });
  }

  const modelName = process.env.AI_DRAFT_MODEL ?? DEFAULT_DRAFT_MODEL;
  const result = await runDraftPipeline({
    db: getDb(),
    model: createAnthropicDraftModel(modelName),
    modelName,
    limit: 5,
  });

  return Response.json({ ok: true, ...result });
}
