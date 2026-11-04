import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { loginAdmin } from "@/actions/admin-auth";
import { signInWithGoogle } from "@/actions/auth";
import { ADMIN_LOCALE, inputClass } from "@/components/admin/styles";
import { isPasswordLoginEnabled } from "@/lib/admin-password";
import { isAuthConfigured } from "@/lib/supabase/server";

const KNOWN_ERRORS = ["invalid", "too_many", "disabled", "not_configured", "oauth_failed"] as const;

// Google sign-in is offered whenever Supabase is configured. The password form only exists
// where isPasswordLoginEnabled allows it (development). Access still needs the admin role.
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const { error } = await searchParams;
  const t = await getTranslations({ locale: ADMIN_LOCALE, namespace: "adminLogin" });

  const errorKey = KNOWN_ERRORS.find((key) => key === error);
  const googleEnabled = isAuthConfigured();
  const passwordEnabled = isPasswordLoginEnabled();

  return (
    <div className="w-full max-w-sm space-y-6 self-center rounded-md border border-line bg-surface p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
        <p className="text-sm text-muted">{t("description")}</p>
      </div>

      {googleEnabled && (
        <form action={signInWithGoogle}>
          <input type="hidden" name="locale" value={ADMIN_LOCALE} />
          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center rounded-md border border-line bg-canvas px-4 font-semibold text-ink hover:bg-raised"
          >
            {t("google")}
          </button>
        </form>
      )}

      {googleEnabled && passwordEnabled && <p className="text-center text-xs text-muted">{t("divider")}</p>}

      {passwordEnabled && (
        <form action={loginAdmin} className="space-y-4">
          <label className="flex flex-col gap-1 text-sm text-ink">
            {t("username")}
            <input name="username" autoComplete="username" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            {t("password")}
            <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
          </label>
          <button type="submit" className="h-10 w-full rounded-md bg-accent px-4 font-semibold text-on-accent">
            {t("submit")}
          </button>
        </form>
      )}

      {errorKey && (
        <p role="alert" className="text-sm text-accent">
          {t(`errors.${errorKey}`)}
        </p>
      )}
      {!googleEnabled && !passwordEnabled && !errorKey && (
        <p role="alert" className="text-sm text-accent">
          {t("errors.disabled")}
        </p>
      )}
    </div>
  );
}
