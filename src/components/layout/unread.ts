import { countUnreadNotifications } from "@/data/community";

// The header must never break a page, so a database error here shows zero.
export async function getUnreadCountSafe(userId: string): Promise<number> {
  try {
    return await countUnreadNotifications(userId);
  } catch {
    return 0;
  }
}
