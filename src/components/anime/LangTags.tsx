import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";

const LANG_NAMES = ["ja", "en", "th"] as const;

// Shows audio and subtitle languages as text tags, for example "JP" and "TH sub".
export async function LangTags({ audio, subs }: { audio: string[]; subs: string[] }) {
  const t = await getTranslations("lang");
  const labelFor = (code: string) =>
    (LANG_NAMES as readonly string[]).includes(code) ? t(code as "ja" | "en" | "th") : code.toUpperCase();

  if (audio.length === 0 && subs.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1" aria-label={`${t("audio")} / ${t("subs")}`}>
      {audio.map((code) => (
        <Badge key={`a-${code}`} tone={code === "th" ? "accent" : "neutral"}>
          {labelFor(code)}
        </Badge>
      ))}
      {subs.map((code) => (
        <Badge key={`s-${code}`} tone={code === "th" ? "accent" : "neutral"}>
          {labelFor(code)} {t("subs")}
        </Badge>
      ))}
    </div>
  );
}
