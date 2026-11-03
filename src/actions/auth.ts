"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/admin-session";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";
import { parseLocale } from "./shared";

// Starts sign-in with Google. The first sign-in creates the account, so there is
// no separate sign-up step and no email to type.
export async function signInWithGoogle(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  if (!isAuthConfigured()) redirect(`/${locale}/login?error=not_configured`);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback?next=/${locale}`,
      // Lets the person choose which Google account to use.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) redirect(`/${locale}/login?error=oauth_failed`);
  redirect(data.url);
}

// Ends the Google session and the back-office session, if either exists.
export async function signOut(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  if (isAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect(`/${locale}`);
}
