import { StaticPageView } from "@/components/legal/StaticPageView";
import { preparePage } from "@/lib/page";

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const locale = await preparePage(params);
  return <StaticPageView page="about" locale={locale} />;
}
