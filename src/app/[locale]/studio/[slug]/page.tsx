import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { JsonLd } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getStudioBySlug } from "@/data/studios";
import { preparePage } from "@/lib/page";
import { studioDisplayName } from "@/lib/studio-name";

type Props = PageProps<"/[locale]/studio/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await connection();

  const data = await getStudioBySlug(slug);
  if (!data) return { title: "404" };

  const name = studioDisplayName(data.studio);
  return {
    title: name,
    description: `${name}`,
    alternates: {
      canonical: `/${locale}/studio/${slug}`,
      languages: Object.fromEntries([
        ...routing.locales.map((code) => [code, `/${code}/studio/${slug}`]),
        ["x-default", `/${routing.defaultLocale}/studio/${slug}`],
      ]),
    },
  };
}

export default async function StudioPage({ params }: Props) {
  const locale = await preparePage(params);
  const { slug } = await params;

  const data = await getStudioBySlug(slug);
  if (!data) notFound();

  const t = await getTranslations("studio");
  const name = studioDisplayName(data.studio);
  // Only approved channels are shown. Pending or revoked ones are not public.
  const channels = data.channels.filter((item) => item.status === "approved");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    alternateName: data.studio.nameRomaji,
    url: data.studio.websiteUrl ?? undefined,
    inLanguage: locale,
    sameAs: channels.map((item) => item.url),
  };

  return (
    <div className="space-y-12">
      <JsonLd data={jsonLd} />

      <header className="space-y-3">
        <Badge>{t(`kind.${data.studio.kind}`)}</Badge>
        <h1 className="text-3xl font-bold text-ink md:text-4xl">{name}</h1>
        {data.studio.websiteUrl && (
          <a
            href={data.studio.websiteUrl}
            rel="noopener noreferrer"
            target="_blank"
            className="inline-block text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {t("officialSite")}
          </a>
        )}
      </header>

      <Section id="works" title={t("works")}>
        {data.titles.length === 0 ? (
          <EmptyState message={t("noWorks")} />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.titles.map((item) => (
              <li key={`${item.slug}-${item.role}`}>
                <Link
                  href={`/anime/${item.slug}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm hover:bg-raised"
                >
                  <span className="text-ink">{item.titleRomaji}</span>
                  <span className="text-xs text-muted">{t(`roles.${item.role}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="channels" title={t("channels")}>
        {channels.length === 0 ? (
          <EmptyState message={t("noChannels")} />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {channels.map((item) => (
              <li key={item.url}>
                <a
                  href={item.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-raised"
                >
                  <span>{item.platform}</span>
                  <Badge>{t("approved")}</Badge>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
