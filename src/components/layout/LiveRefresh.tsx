"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

const REFRESH_EVERY_MS = 5 * 60 * 1000;

// Re-renders the current page from the server every few minutes while the tab is visible,
// so new episodes show up without a reload. No websocket is used.
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_EVERY_MS);
    return () => window.clearInterval(id);
  }, [router]);

  return null;
}
