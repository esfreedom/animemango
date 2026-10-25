import { z } from "zod";

// AniList GraphQL API. Terms: free under $150/month revenue, a commercial license
// is needed above that, and bulk collection or storage is prohibited (see README).
// This client only asks for a short airing window, never the whole catalog.
const ENDPOINT = "https://graphql.anilist.co";
const PER_PAGE = 50;
const MAX_RETRIES = 3;

const AIRING_WINDOW_QUERY = `
query AiringWindow($from: Int!, $to: Int!, $page: Int!) {
  Page(page: $page, perPage: ${PER_PAGE}) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      episode
      airingAt
      media {
        id
        idMal
        format
        status
        episodes
        genres
        averageScore
        season
        seasonYear
        startDate { year month day }
        title { romaji english native }
        coverImage { extraLarge }
        bannerImage
        isAdult
      }
    }
  }
}`;

const mediaSchema = z.object({
  id: z.number(),
  idMal: z.number().nullable(),
  format: z.string().nullable(),
  status: z.string().nullable(),
  episodes: z.number().nullable(),
  genres: z.array(z.string()).nullable(),
  averageScore: z.number().nullable(),
  season: z.string().nullable(),
  seasonYear: z.number().nullable(),
  startDate: z
    .object({
      year: z.number().nullable(),
      month: z.number().nullable(),
      day: z.number().nullable(),
    })
    .nullable(),
  title: z.object({
    romaji: z.string().nullable(),
    english: z.string().nullable(),
    native: z.string().nullable(),
  }),
  coverImage: z.object({ extraLarge: z.string().nullable() }).nullable(),
  bannerImage: z.string().nullable(),
  isAdult: z.boolean(),
});

const pageSchema = z.object({
  data: z.object({
    Page: z.object({
      pageInfo: z.object({ hasNextPage: z.boolean() }),
      airingSchedules: z.array(
        z.object({
          episode: z.number(),
          airingAt: z.number(),
          media: mediaSchema,
        }),
      ),
    }),
  }),
});

export type AniListMedia = z.infer<typeof mediaSchema>;
export type AniListAiringEntry = z.infer<typeof pageSchema>["data"]["Page"]["airingSchedules"][number];

export type FetchLike = typeof fetch;

// Returns every airing entry between `from` and `to` (Unix seconds).
export async function fetchAiringWindow(
  { from, to }: { from: number; to: number },
  fetchImpl: FetchLike = fetch,
): Promise<AniListAiringEntry[]> {
  const entries: AniListAiringEntry[] = [];
  let page = 1;

  for (;;) {
    const body = await postWithRetry(
      { query: AIRING_WINDOW_QUERY, variables: { from, to, page } },
      fetchImpl,
    );
    const parsed = pageSchema.parse(body);
    entries.push(...parsed.data.Page.airingSchedules);

    if (!parsed.data.Page.pageInfo.hasNextPage) return entries;
    page++;
  }
}

async function postWithRetry(payload: unknown, fetchImpl: FetchLike): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "30");
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 60) * 1000));
      continue;
    }

    if (!response.ok) {
      throw new Error(`AniList responded with HTTP ${response.status}`);
    }
    return response.json();
  }
}
