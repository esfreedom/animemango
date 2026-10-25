import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import type { ResolvedTitle } from "@/lib/titles";

// Shows a title and marks it when the viewer's language is not available yet.
export async function TitleFallbackNote({ resolved }: { resolved: ResolvedTitle }) {
  if (!resolved.isFallback) return null;
  const t = await getTranslations("lang");
  return <Badge>{t("fallback")}</Badge>;
}
