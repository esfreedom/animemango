import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { routing } from "@/i18n/routing";
import { isAdminHost } from "@/lib/admin-host";
import { syncUserRecord } from "@/lib/session";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";

// Finishes the Google sign-in. Exchanges the one-time code for a session cookie and makes
// sure the users row exists before the person lands on the page they came from.
// Only same-site relative paths are accepted for "next", to prevent open redirects.
// A flow started on the back-office host comes back there and ends on its login page on error.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const onAdminHost = isAdminHost({ host: request.headers.get("host"), adminSiteUrl: process.env.ADMIN_SITE_URL });
  const rawNext = url.searchParams.get("next") ?? "";
  const isSafePath = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\");
  const next = isSafePath ? rawNext : onAdminHost ? "/" : `/${routing.defaultLocale}`;
  const segment = next.split("/")[1] ?? "";
  const locale = (routing.locales as readonly string[]).includes(segment) ? segment : routing.defaultLocale;
  const loginPath = onAdminHost ? "/login" : `/${locale}/login`;

  const loginWithError = (error: string) => NextResponse.redirect(new URL(`${loginPath}?error=${error}`, url.origin));

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
