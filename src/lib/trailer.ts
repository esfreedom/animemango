// A trailer may be embedded only when its channel was approved by an admin and the approval
// includes trailers (approved plan, section 3). Revoking the channel removes the embed at once.

export type ChannelApproval = {
  status: "pending" | "approved" | "revoked";
  allowTrailer: boolean;
} | null;

export function canEmbedTrailer(channel: ChannelApproval): boolean {
  return channel !== null && channel.status === "approved" && channel.allowTrailer;
}

// YouTube video IDs are 11 characters. The check is loose on purpose and only rejects obvious junk.
export function isYoutubeVideoId(value: string): boolean {
  return /^[A-Za-z0-9_-]{6,20}$/.test(value);
}
