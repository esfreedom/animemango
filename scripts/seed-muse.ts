// Adds Muse Thailand's on-demand anime to the database: the studio, its YouTube channel
// (pending approval), each title from AniList as a published entry, its official Thai name,
// and one YouTube availability row per playlist. Safe to run again: existing rows are kept.
// Usage: npm run db:seed-muse. It refuses to run when NODE_ENV is production.
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { importAnimeByAniListId } from "../src/anilist/sync";
import {
  anime,
  animeI18n,
  animeStudio,
  platform,
  platformAvailability,
  studio,
  studioChannel,
} from "../src/db/schema";
import * as schema from "../src/db/schema";
import { MUSE_CHANNEL, MUSE_ENTRIES, playlistUrl } from "./data/muse-thailand";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed sample data when NODE_ENV is production.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const db = drizzle(sql, { schema });
    const now = new Date();

    await db
      .insert(platform)
      .values({ name: "YouTube", officialUrl: "https://www.youtube.com", regions: ["TH"] })
      .onConflictDoNothing({ target: platform.name });
    const [youtube] = await db.select({ id: platform.id }).from(platform).where(eq(platform.name, "YouTube")).limit(1);

    await db
      .insert(studio)
      .values({
        slug: MUSE_CHANNEL.studioSlug,
        nameRomaji: MUSE_CHANNEL.studioName,
        kind: "distributor",
        websiteUrl: MUSE_CHANNEL.websiteUrl,
      })
      .onConflictDoNothing({ target: studio.slug });
    const [owner] = await db.select({ id: studio.id }).from(studio).where(eq(studio.slug, MUSE_CHANNEL.studioSlug)).limit(1);

    // A new channel stays pending. Nothing from it can be embedded until an admin approves it.
    await db
      .insert(studioChannel)
      .values({
        studioId: owner.id,
        platform: "youtube",
        channelId: MUSE_CHANNEL.channelId,
        url: MUSE_CHANNEL.channelUrl,
        status: "pending",
        allowTrailer: false,
        evidenceUrl: MUSE_CHANNEL.channelUrl,
      })
      .onConflictDoNothing();

    let added = 0;
    for (const entry of MUSE_ENTRIES) {
      const result = await importAnimeByAniListId({ db, anilistId: entry.anilistId, now });
      if (!result) {
        console.warn(`skipped AniList ${entry.anilistId}: not found or adult`);
        continue;
      }
      const animeId = result.animeId;

      // Muse's own playlist title is the official Thai name for this title.
      await db
        .update(anime)
        .set({ published: true, updatedAt: now })
        .where(eq(anime.id, animeId));
      await db
        .insert(animeI18n)
        .values({
          animeId,
          locale: "th",
          title: entry.titleTh,
          source: "official",
          sourceUrl: playlistUrl(entry.playlists[0].id),
        })
        .onConflictDoNothing({ target: [animeI18n.animeId, animeI18n.locale] });

      await db
        .insert(animeStudio)
        .values({ animeId, studioId: owner.id, role: "distribute" })
        .onConflictDoNothing();

      for (const playlist of entry.playlists) {
        const sourceUrl = playlistUrl(playlist.id);
        const [existing] = await db
          .select({ id: platformAvailability.id })
          .from(platformAvailability)
          .where(
            and(
              eq(platformAvailability.animeId, animeId),
              eq(platformAvailability.platformId, youtube.id),
              eq(platformAvailability.sourceUrl, sourceUrl),
            ),
          )
          .limit(1);
        if (existing) continue;

        await db.insert(platformAvailability).values({
          animeId,
          platformId: youtube.id,
          region: "TH",
          audioLangs: playlist.audio,
          subLangs: playlist.sub,
          coversAllEpisodes: false,
          sourceUrl,
          verifiedAt: now,
        });
      }
      added++;
      console.log(`ok ${entry.titleTh} (AniList ${entry.anilistId})`);
    }

    console.log(`done: ${added} of ${MUSE_ENTRIES.length} titles`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
