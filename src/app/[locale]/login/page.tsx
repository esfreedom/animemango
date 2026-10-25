import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { preparePage } from "@/lib/page";

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const locale = await preparePage(params);
  const t = await getTranslations("login");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>
      <p className="text-sm text-muted">{t("description")}</p>
      <LoginForm locale={locale} />
    </div>
  );
}
