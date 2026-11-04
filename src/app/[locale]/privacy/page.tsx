import { StaticPageView } from "@/components/legal/StaticPageView";
import { preparePage } from "@/lib/page";

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const locale = await preparePage(params);
  return <StaticPageView page="privacy" locale={locale} />;
}
