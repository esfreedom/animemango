// What the AI may write, and what needs a person (approved plan, section 6).
// This is code, not prompt text, so a model cannot talk its way past it.

export const PROPOSAL_KINDS = ["metadata", "grouping", "season_label", "availability", "announcement"] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export type PolicyDecision =
  | { action: "auto_apply" }
  | { action: "pending" }
  | { action: "reject"; reason: string };

export type PolicyInput = {
  // True when every source URL passes isAllowedSourceUrl.
  sourcesAllowed: boolean;
  // True when the proposal follows a fixed rule (for example, a season label derived from
  // the AniList relation graph), and not from a model guess.
  deterministic: boolean;
  // True when the rule could not decide cleanly (for example, two candidate groupings).
  ambiguous: boolean;
};

export function decideProposal(kind: ProposalKind, input: PolicyInput): PolicyDecision {
  if (!input.sourcesAllowed) return { action: "reject", reason: "source_not_allowed" };

  // Structure can be applied automatically only when a fixed rule produced it.
  if ((kind === "grouping" || kind === "season_label") && input.deterministic && !input.ambiguous) {
    return { action: "auto_apply" };
  }

  // Titles, availability (licensing) and announcements always wait for a person.
  return { action: "pending" };
}

const ANILIST_HOST = "anilist.co";

// Only https links to a known host are accepted. Known hosts are AniList, the official
// site of each platform, and the official sources listed in OFFICIAL_SOURCE_HOSTS.
export function isAllowedSourceUrl(rawUrl: string, allowedHosts: string[]): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  const hosts = [ANILIST_HOST, ...allowedHosts.map((item) => item.toLowerCase())];
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

// Hosts from the platform table plus the optional OFFICIAL_SOURCE_HOSTS environment list.
export function allowedHostsFrom(platformUrls: string[], envValue: string | undefined): string[] {
  const fromPlatforms = platformUrls.flatMap((value) => {
    try {
      return [new URL(value).hostname];
    } catch {
      return [];
    }
  });
  const fromEnv = (envValue ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([...fromPlatforms, ...fromEnv])];
}
