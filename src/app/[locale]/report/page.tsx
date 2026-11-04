import { getTranslations } from "next-intl/server";
import { TakedownForm } from "@/components/report/TakedownForm";
import { preparePage } from "@/lib/page";

export default async function ReportPage({ params }: PageProps<"/[locale]/report">) {
  await preparePage(params);
  const t = await getTranslations("report");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>
      <p className="text-sm text-muted">{t("description")}</p>
      <TakedownForm />
    </div>
  );
}
