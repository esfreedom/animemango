import { revalidateTag } from "next/cache";
import { getDb } from "@/db/client";
import { syncAiringWindow } from "@/anilist/sync";

// Runs on a schedule (see vercel.json). Only a short window around today is synced,
// which keeps requests and stored data small (see the AniList terms in README.md).
const PAST_DAYS = 1;
const FUTURE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const result = await syncAiringWindow({
    db: getDb(),
    from: new Date(now.getTime() - PAST_DAYS * DAY_MS),
    to: new Date(now.getTime() + FUTURE_DAYS * DAY_MS),
    now,
  });

  revalidateTag("anime", "max");
  revalidateTag("threads", "max");
  return Response.json({ ok: true, ...result });
}
