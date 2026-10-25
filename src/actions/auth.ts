"use server";

import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";
import type { ActionResult } from "./shared";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sends a one-time sign-in link by email (Supabase email OTP).
export async function sendSignInLink(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const locale = parseLocale(formData.get("locale"));

  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: "invalid_email" };
  if (!isAuthConfigured()) return { ok: false, error: "not_configured" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback?next=/${locale}` },
  });

  return error ? { ok: false, error: "send_failed" } : { ok: true };
}

export async function signOut(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  if (isAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect(`/${locale}`);
}

function parseLocale(value: FormDataEntryValue | null): string {
  const candidate = String(value ?? "");
  return (routing.locales as readonly string[]).includes(candidate) ? candidate : routing.defaultLocale;
}
