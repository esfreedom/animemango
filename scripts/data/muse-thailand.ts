// Muse Thailand's YouTube playlists of full episodes that can be watched at any time.
// Live premieres and the "จำกัดเวลา" (limited-time) playlist are left out on purpose.
// Thai names come from the playlist titles on Muse's official channel. AniList ids were matched by hand.
export const MUSE_CHANNEL = {
  studioSlug: "muse-thailand",
  studioName: "Muse Communication",
  websiteUrl: "https://th.e-muse.com",
  channelId: "UCn8hjQOnGYR1AZtYYMYP5jQ",
  channelUrl: "https://www.youtube.com/@MuseThailand",
} as const;

export type MusePlaylist = { id: string; audio: string[]; sub: string[] };
export type MuseEntry = { anilistId: number; titleTh: string; playlists: MusePlaylist[] };

// Dubbed playlists are Thai audio. Subbed playlists are Japanese audio with Thai subtitles.
const dub = (id: string): MusePlaylist => ({ id, audio: ["th"], sub: [] });
const sub = (id: string): MusePlaylist => ({ id, audio: ["ja"], sub: ["th"] });

export const MUSE_ENTRIES: MuseEntry[] = [
  { anilistId: 8687, titleTh: "โดราเอมอน", playlists: [sub("PLExyiN2YE4Sk")] },
  { anilistId: 16498, titleTh: "ผ่าพิภพไททัน", playlists: [dub("PLd3SXPj3YVtc"), sub("PLQSuMn76j9NQ")] },
  { anilistId: 205909, titleTh: "วิวาห์แห่งหิ่งห้อย", playlists: [sub("PLYtASagUby4A")] },
  { anilistId: 187538, titleTh: "BLACK TORCH", playlists: [dub("PLH5ktXbnY4Q8"), sub("PLSeOkuBASRrg")] },
  { anilistId: 113813, titleTh: "สะดุดรักยัยแฟนเช่า", playlists: [dub("PLF_OYMz95-fM")] },
  { anilistId: 106893, titleTh: "COP CRAFT", playlists: [sub("PLXfi29_5FphU")] },
  { anilistId: 107693, titleTh: "อิรุมะคุง ผจญในแดนปีศาจ!", playlists: [dub("PLVjk1JH3axAk")] },
  { anilistId: 116338, titleTh: "อิรุมะคุง ผจญในแดนปีศาจ! ซีซั่น 2", playlists: [dub("PLCQXl3vcekkg")] },
  { anilistId: 139092, titleTh: "อิรุมะคุง ผจญในแดนปีศาจ! ซีซั่น 3", playlists: [dub("PLLlqWnVblXQY")] },
  { anilistId: 184492, titleTh: "อิรุมะคุง ผจญในแดนปีศาจ! ซีซั่น 4", playlists: [dub("PLRIrRbfQ86dY")] },
  { anilistId: 101280, titleTh: "เกิดใหม่ทั้งทีก็เป็นสไลม์ไปซะแล้ว", playlists: [dub("PLbgcjHekySy0")] },
  { anilistId: 108511, titleTh: "เกิดใหม่ทั้งทีก็เป็นสไลม์ไปซะแล้ว ซีซั่น 2", playlists: [dub("PLbgcjHekySy0")] },
  { anilistId: 156822, titleTh: "เกิดใหม่ทั้งทีก็เป็นสไลม์ไปซะแล้ว ซีซั่น 3", playlists: [dub("PLbgcjHekySy0")] },
  { anilistId: 206521, titleTh: "THE WORLD IS DANCING", playlists: [sub("PLZNWaIPTqdfY")] },
  { anilistId: 198376, titleTh: "BanG Dream! YUME∞MITA", playlists: [sub("PLLogB-dKY6Ns")] },
  { anilistId: 204466, titleTh: "สาวน้อยไคจูคาราเมไลซ์", playlists: [sub("PLJxvs3el8QHI")] },
  { anilistId: 185756, titleTh: "เกิดชาตินี้พี่ต้องเทพ ซีซั่น 3", playlists: [dub("PLejQDyu3nwB0")] },
  { anilistId: 180136, titleTh: "เกิดใหม่เป็นอัศวินเกราะหนักผู้ถูกขับไล่แต่ใช้ความรู้จากเกมจนไร้เทียมทาน", playlists: [dub("PLVeMdEfaq_Cw"), sub("PLNuFJ7GG5XUw")] },
  { anilistId: 202250, titleTh: "พลังเวทที่ให้ยืมไปจะถูกบังคับเรียกเก็บผ่าน \"การผ่อนชำระ\"", playlists: [sub("PLfwUUMqJkNeY")] },
  { anilistId: 187402, titleTh: "สตรีศักดิ์สิทธิ์เกิดใหม่ แต่ไม่ขอบอกใครนะคะ", playlists: [sub("PLGUlP6RGLsis")] },
  { anilistId: 186742, titleTh: "ไอเทม ปฏิบัติการลับด้านมืด", playlists: [sub("PLKfbR6rgKhGY")] },
  { anilistId: 213068, titleTh: "เทพยุทธ์จ้าวสรรพสัตว์ ดันดีไวน์", playlists: [sub("PLUaLEp_0v7ak")] },
];

export function playlistUrl(id: string): string {
  return `https://www.youtube.com/playlist?list=${id}`;
}
