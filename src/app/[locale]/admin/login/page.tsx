import { getTranslations } from "next-intl/server";
import { loginAdmin } from "@/actions/admin-auth";
import { isPasswordLoginEnabled } from "@/lib/admin-password";
import { preparePage } from "@/lib/page";

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

const KNOWN_ERRORS = ["invalid", "too_many", "disabled", "not_configured"] as const;

const inputClass = "h-10 rounded-md border border-line bg-canvas px-3 text-sm text-ink";

export default async function AdminLoginPage({ params, searchParams }: PageProps<"/[locale]/admin/login">) {
  const locale = await preparePage(params);
  const { error } = await searchParams;
  const t = await getTranslations("adminLogin");

  const errorKey = KNOWN_ERRORS.find((key) => key === error);
  const enabled = isPasswordLoginEnabled();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>
      <p className="text-sm text-muted">{t("description")}</p>

      {enabled ? (
        <form action={loginAdmin} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
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
      ) : null}

      {errorKey && (
        <p role="alert" className="text-sm text-accent">
          {t(`errors.${errorKey}`)}
        </p>
      )}
      {!enabled && !errorKey && (
        <p role="alert" className="text-sm text-accent">
          {t("errors.disabled")}
        </p>
      )}
    </div>
  );
}
