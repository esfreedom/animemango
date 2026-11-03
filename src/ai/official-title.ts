import { isAllowedSourceUrl } from "./policy";

// A Thai display name must come from an official source, and the AniList record does not count
// (it has no Thai names, and it is the wrong kind of source for rights-holder names).

const THAI_LETTERS = /[฀-๿]/;
const ANILIST_HOST = /(^|\.)anilist\.co$/i;

export function isOfficialTitleSource(rawUrl: string, allowedHosts: string[]): boolean {
  if (!isAllowedSourceUrl(rawUrl, allowedHosts)) return false;
  const host = new URL(rawUrl).hostname;
  return !ANILIST_HOST.test(host);
}

export type OfficialTitleInput = { titleTh: string; sourceUrl: string };

export function validateOfficialTitle(
  input: OfficialTitleInput,
  allowedHosts: string[],
): { ok: true; titleTh: string } | { ok: false; errors: string[] } {
  const titleTh = input.titleTh.trim();
  const errors: string[] = [];

  if (titleTh.length === 0 || titleTh.length > 200) errors.push("title_length");
  if (!THAI_LETTERS.test(titleTh)) errors.push("title_needs_thai");
  if (!isOfficialTitleSource(input.sourceUrl, allowedHosts)) errors.push("source_not_official");

  return errors.length === 0 ? { ok: true, titleTh } : { ok: false, errors };
}
