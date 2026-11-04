import { StaticPageView } from "@/components/legal/StaticPageView";
import { preparePage } from "@/lib/page";

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const locale = await preparePage(params);
  return <StaticPageView page="terms" locale={locale} />;
}
