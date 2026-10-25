import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { anime, platform, proposal, series } from "@/db/schema";
import { parseProposalPayload } from "@/ai/proposals";
import { decideProposal, allowedHostsFrom, isAllowedSourceUrl, PROPOSAL_KINDS } from "@/ai/policy";
import { checkOpsToken } from "@/lib/ops-auth";

// The AI writes proposals here and nothing else. A person approves them in /admin.
// Every proposal is stored as pending or rejected. None is applied by this route.

const envelope = z
  .object({
    kind: z.enum(PROPOSAL_KINDS),
    animeSlug: z.string().min(1).max(200).optional(),
    seriesSlug: z.string().min(1).max(200).optional(),
    payload: z.unknown(),
    sources: z.array(z.object({ field: z.string().min(1).max(40), url: z.string().min(1).max(2000) })).max(20),
    aiModel: z.string().min(1).max(100),
    promptVersion: z.string().min(1).max(40),
  })
  .strict();

export async function POST(request: Request) {
  const auth = checkOpsToken(request.headers.get("authorization"), process.env.OPS_API_TOKEN);
  if (auth === "not_configured") return Response.json({ error: "OPS_API_TOKEN is not set" }, { status: 503 });
  if (auth === "unauthorized") return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = envelope.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "invalid_envelope", details: body.error.issues.length }, { status: 400 });
  }
  const { kind, animeSlug, seriesSlug, payload, sources, aiModel, promptVersion } = body.data;

  const db = getDb();
  const [animeRow] = animeSlug
    ? await db.select({ id: anime.id }).from(anime).where(eq(anime.slug, animeSlug)).limit(1)
    : [undefined];
  const [seriesRow] = seriesSlug
    ? await db.select({ id: series.id }).from(series).where(eq(series.slug, seriesSlug)).limit(1)
    : [undefined];
  if ((animeSlug && !animeRow) || (seriesSlug && !seriesRow)) {
    return Response.json({ error: "unknown_slug" }, { status: 422 });
  }

  const platforms = await db.select({ name: platform.name, officialUrl: platform.officialUrl }).from(platform);
  const allowedHosts = allowedHostsFrom(platforms.map((item) => item.officialUrl), process.env.OFFICIAL_SOURCE_HOSTS);

  const parsed = parseProposalPayload(kind, payload);
  const errors: string[] = parsed.ok ? [] : [...parsed.errors];

  const sourceUrls = [...sources.map((item) => item.url), ...(parsed.ok ? parsed.value.sourceUrls : [])];
  const disallowed = sourceUrls.filter((url) => !isAllowedSourceUrl(url, allowedHosts));
  errors.push(...disallowed.map((url) => `source_not_allowed: ${url}`));

  if (parsed.ok && kind === "availability") {
    const platformName = String(parsed.value.payload.platformName);
    if (!platforms.some((item) => item.name === platformName)) errors.push(`unknown_platform: ${platformName}`);
  }

  // Structure is never "deterministic" when it comes from a model, so the policy keeps it pending.
  const decision = decideProposal(kind, {
    sourcesAllowed: disallowed.length === 0,
    deterministic: false,
    ambiguous: false,
  });
  const status = errors.length > 0 ? "rejected" : decision.action === "reject" ? "rejected" : "pending";

  const [created] = await db
    .insert(proposal)
    .values({
      kind,
      animeId: animeRow?.id ?? null,
      seriesId: seriesRow?.id ?? null,
      payload: parsed.ok && errors.length === 0 ? parsed.value.payload : { errors },
      sources: sources.length > 0 ? sources : sourceUrls.map((url) => ({ field: "source", url })),
      aiModel,
      promptVersion,
      status,
    })
    .returning({ id: proposal.id, status: proposal.status });

  return Response.json({ id: created.id, status: created.status, errors }, { status: status === "rejected" ? 422 : 201 });
}
