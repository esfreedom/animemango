import { StaticPageView } from "@/components/legal/StaticPageView";
import { preparePage } from "@/lib/page";

// Renders per request (see preparePage), so instant-navigation validation is opted out.
export const instant = false;

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  const locale = await preparePage(params);
  return <StaticPageView page="terms" locale={locale} />;
}
