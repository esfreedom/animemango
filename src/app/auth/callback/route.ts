import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { routing } from "@/i18n/routing";
import { syncUserRecord } from "@/lib/session";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";

// Finishes the Google sign-in. Exchanges the one-time code for a session cookie and makes
// sure the users row exists before the person lands on the page they came from.
// Only same-site relative paths are accepted for "next", to prevent open redirects.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawNext = url.searchParams.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : `/${routing.defaultLocale}`;
  const segment = next.split("/")[1] ?? "";
  const locale = (routing.locales as readonly string[]).includes(segment) ? segment : routing.defaultLocale;

  const loginWithError = (error: string) =>
    NextResponse.redirect(new URL(`/${locale}/login?error=${error}`, url.origin));

  if (!isAuthConfigured()) return loginWithError("not_configured");

  const code = url.searchParams.get("code");
  if (!code) return loginWithError("oauth_failed");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return loginWithError("oauth_failed");

  const { data } = await supabase.auth.getUser();
  if (data.user) await syncUserRecord(getDb(), data.user);

  return NextResponse.redirect(new URL(next, url.origin));
}
