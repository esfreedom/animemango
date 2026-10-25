import { NextResponse } from "next/server";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";

// Exchanges the one-time code from the sign-in email for a session cookie.
// Only same-site relative paths are accepted for "next", to prevent open redirects.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/th";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/th";

  if (!isAuthConfigured() || !code) {
    return NextResponse.redirect(new URL("/th/login", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/th/login", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
