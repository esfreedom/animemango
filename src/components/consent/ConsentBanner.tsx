import { getTranslations } from "next-intl/server";
import { setConsent } from "@/actions/consent";
import { Link } from "@/i18n/navigation";

// Both choices are plain buttons with equal weight, and declining is the default. The form works without JavaScript.
export async function ConsentBanner() {
  const t = await getTranslations("consent");

  return (
    <section
      aria-label={t("title")}
      className="fixed inset-x-0 bottom-20 z-40 mx-4 space-y-3 rounded-lg border border-line bg-surface p-4 shadow-lg md:bottom-4 md:left-auto md:right-4 md:mx-0 md:max-w-md"
    >
      <p className="text-sm text-ink">
        {t("body")}{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          {t("privacyLink")}
        </Link>
      </p>
      <div className="flex gap-2">
        <form action={setConsent}>
          <input type="hidden" name="value" value="declined" />
          <button type="submit" className="h-9 rounded-md border border-line px-3 text-sm text-ink hover:bg-raised">
            {t("decline")}
          </button>
        </form>
        <form action={setConsent}>
          <input type="hidden" name="value" value="accepted" />
          <button type="submit" className="h-9 rounded-md bg-accent px-3 text-sm font-semibold text-on-accent">
            {t("accept")}
          </button>
        </form>
      </div>
    </section>
  );
}
