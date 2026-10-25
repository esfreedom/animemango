import { getTranslations } from "next-intl/server";
import { signInWithGoogle } from "@/actions/auth";
import { preparePage } from "@/lib/page";

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

const KNOWN_ERRORS = ["not_configured", "oauth_failed"] as const;

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const locale = await preparePage(params);
  const { error } = await searchParams;
  const t = await getTranslations("login");

  const errorKey = KNOWN_ERRORS.find((key) => key === error);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>
      <p className="text-sm text-muted">{t("description")}</p>

      <form action={signInWithGoogle} className="space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center rounded-md border border-line bg-surface px-4 font-semibold text-ink hover:bg-raised"
        >
          {t("google")}
        </button>
        <p className="text-xs text-muted">{t("newAccount")}</p>
      </form>

      {errorKey && (
        <p role="alert" className="text-sm text-accent">
          {t(`errors.${errorKey}`)}
        </p>
      )}
    </div>
  );
}
