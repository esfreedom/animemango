"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminSiteOrigin, isAdminHost } from "@/lib/admin-host";
import { SESSION_COOKIE } from "@/lib/admin-session";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";
import { parseLocale } from "./shared";

// Starts sign-in with Google. The first sign-in creates the account, so there is
// no separate sign-up step and no email to type.
// Started from the back-office host, the flow returns to that host. Its session cookies
// then stay there and the public site never sees them.
export async function signInWithGoogle(formData: FormData) {
  const locale = parseLocale(formData.get("locale"));
  const requestHost = (await headers()).get("host");
  const adminOrigin = isAdminHost({ host: requestHost, adminSiteUrl: process.env.ADMIN_SITE_URL })
    ? adminSiteOrigin(process.env.ADMIN_SITE_URL)
    : null;
  const loginPath = adminOrigin ? "/login" : `/${locale}/login`;

  if (!isAuthConfigured()) redirect(`${loginPath}?error=not_configured`);

  const callback = adminOrigin
    ? `${adminOrigin}/auth/callback?next=/`
    : `${getSiteUrl()}/auth/callback?next=/${locale}`;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback,
      // Lets the person choose which Google account to use.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) redirect(`${loginPath}?error=oauth_failed`);
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
