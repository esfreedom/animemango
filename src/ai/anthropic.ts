import Anthropic from "@anthropic-ai/sdk";
import type { DraftInput, DraftModel } from "./pipeline";

export const DEFAULT_DRAFT_MODEL = "claude-sonnet-5-5";

const SYSTEM_PROMPT = `You write draft Thai metadata for an anime information site. A human reviews every draft before it is shown.

Use only the facts in the input JSON. Do not add plot details, cast, staff, dates, or episode counts that the input does not contain. If you cannot support a field, return null for it.

Return only one JSON object with exactly these keys:
- "titleTh": always null. Thai titles are official names, so people add them from official sources
- "synopsisTh": one or two neutral Thai sentences that describe only the format, episode count, start date and genres. No spoilers. Or null.
- "genresTh": Thai names for the genres in the input
- "unknownFields": the input fields you could not use

Never include links, URLs, or any words about where to watch, stream, or download.`;

// Calls the Anthropic Messages API. Reads ANTHROPIC_API_KEY from the environment.
export function createAnthropicDraftModel(model: string = process.env.AI_DRAFT_MODEL ?? DEFAULT_DRAFT_MODEL): DraftModel {
  const client = new Anthropic();

  return {
    async draft(input: DraftInput) {
      const response = await client.messages.create({
        model,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(input) }],
      });

      const text = response.content
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("");
      return parseJsonObject(text);
    },
  };
}

// The model sometimes wraps JSON in a code fence. Take the outermost object.
export function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("No JSON object in model output");
  return JSON.parse(text.slice(start, end + 1));
}
