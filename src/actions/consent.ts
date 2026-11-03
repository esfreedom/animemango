"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { CONSENT_COOKIE, CONSENT_MAX_AGE_S, parseConsent } from "@/lib/consent";

// Saves the visitor's choice. The page is refreshed so the banner hides and analytics loads or stays off.
export async function setConsent(formData: FormData) {
  const value = parseConsent(String(formData.get("value") ?? ""));
  if (!value) return;

  const cookieStore = await cookies();
  cookieStore.set(CONSENT_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CONSENT_MAX_AGE_S,
  });
  refresh();
}
