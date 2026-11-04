import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { anime, animeStudio, studio, studioChannel } from "@/db/schema";

// Studio profiles. Admin pages read these on each request, and the public profile page
// is cached by tag so an approval change shows up at once (see actions/studios.ts).

export async function listStudios() {
  return getDb().select().from(studio).orderBy(asc(studio.nameRomaji));
}

export async function listChannels() {
  return getDb()
    .select({
      id: studioChannel.id,
      studioId: studioChannel.studioId,
      studioName: studio.nameRomaji,
      platform: studioChannel.platform,
      channelId: studioChannel.channelId,
      url: studioChannel.url,
      status: studioChannel.status,
      allowTrailer: studioChannel.allowTrailer,
      evidenceUrl: studioChannel.evidenceUrl,
    })
    .from(studioChannel)
    .innerJoin(studio, eq(studioChannel.studioId, studio.id))
    .orderBy(asc(studio.nameRomaji));
}

// Every studio-to-title link, so the admin page can list and remove them.
export async function listStudioLinks() {
  return getDb()
    .select({
      studioSlug: studio.slug,
      studioName: studio.nameRomaji,
      animeSlug: anime.slug,
      titleRomaji: anime.titleRomaji,
      role: animeStudio.role,
    })
    .from(animeStudio)
    .innerJoin(studio, eq(animeStudio.studioId, studio.id))
    .innerJoin(anime, eq(animeStudio.animeId, anime.id))
    .orderBy(asc(studio.nameRomaji), asc(anime.titleRomaji));
}

export async function getStudioBySlug(slug: string) {
  const db = getDb();
  const [row] = await db.select().from(studio).where(eq(studio.slug, slug)).limit(1);
  if (!row) return null;

  const [channels, titles] = await Promise.all([
    db
      .select({
        platform: studioChannel.platform,
        url: studioChannel.url,
        status: studioChannel.status,
      })
      .from(studioChannel)
      .where(eq(studioChannel.studioId, row.id)),
    db
      .select({
        slug: anime.slug,
        titleRomaji: anime.titleRomaji,
        role: animeStudio.role,
      })
      .from(animeStudio)
      .innerJoin(anime, eq(animeStudio.animeId, anime.id))
      .where(and(eq(animeStudio.studioId, row.id), eq(anime.published, true))),
  ]);

  return { studio: row, channels, titles };
}
