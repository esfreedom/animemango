import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { getProfile } from "@/data/community";
import { preparePage } from "@/lib/page";
import { formatAirTime } from "@/lib/time";

export default async function ProfilePage({ params }: PageProps<"/[locale]/u/[username]">) {
  const locale = await preparePage(params);
  const { username } = await params;

  const profile = await getProfile(username);
  if (!profile) notFound();

  const t = await getTranslations("profile");
  const tComments = await getTranslations("comments");
  const tCommon = await getTranslations("common");

  return (
    <div className="space-y-10">
      <header className="flex items-center gap-4">
        {profile.user.avatarUrl ? (
          <Image
            src={profile.user.avatarUrl}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 rounded-full border border-line object-cover"
          />
        ) : (
          <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-raised text-xl text-muted">
            {profile.user.username.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-ink">
            {t("title", { username: profile.user.displayName ?? profile.user.username })}
          </h1>
          <p className="text-sm text-muted">
            @{profile.user.username} · {t("joined", { date: formatAirTime(profile.user.createdAt, locale, "Asia/Bangkok") })}
          </p>
        </div>
      </header>

      <Section id="profile-follows" title={t("follows")}>
        {profile.follows.length === 0 ? (
          <EmptyState message={t("empty")} />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {profile.follows.map((item) => (
              <li key={item.slug}>
                <Link href={`/anime/${item.slug}`} className="rounded-full border border-line px-3 py-1 text-sm text-ink hover:bg-raised">
                  {item.titleRomaji}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="profile-comments" title={t("comments")}>
        {profile.comments.length === 0 ? (
          <EmptyState message={tCommon("notAvailable")} />
        ) : (
          <ul className="space-y-3">
            {profile.comments.map((item) => (
              <li key={item.id} className="rounded-lg border border-line bg-surface p-4 text-sm">
                <p className="whitespace-pre-wrap text-ink">{item.body}</p>
                <p className="mt-2 text-xs text-muted">
                  {tComments("langTag")}: {item.lang.toUpperCase()} · {formatAirTime(item.createdAt, locale, "Asia/Bangkok")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
