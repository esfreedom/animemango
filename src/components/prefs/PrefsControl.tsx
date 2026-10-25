"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { setPreferences } from "@/actions/prefs";
import { AUDIO_OPTIONS, SUB_OPTIONS, type AudioPref, type Prefs, type SubPref } from "@/lib/prefs";

// Lets the viewer pick audio and subtitle languages. The choice is remembered: a cookie for
// guests and the profile for signed-in users (see actions/prefs.ts).
export function PrefsControl({ prefs }: { prefs: Prefs }) {
  const t = useTranslations("prefs");
  const tLang = useTranslations("lang");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(next: Prefs) {
    startTransition(async () => {
      await setPreferences(next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3" aria-busy={pending}>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t("audio")}
        <select
          value={prefs.audio ?? ""}
          onChange={(event) => update({ ...prefs, audio: (event.target.value || null) as AudioPref | null })}
          className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
        >
          <option value="">{t("none")}</option>
          {AUDIO_OPTIONS.map((code) => (
            <option key={code} value={code}>
              {tLang(code)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        {t("sub")}
        <select
          value={prefs.sub ?? ""}
          onChange={(event) => update({ ...prefs, sub: (event.target.value || null) as SubPref | null })}
          className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
        >
          <option value="">{t("none")}</option>
          {SUB_OPTIONS.map((code) => (
            <option key={code} value={code}>
              {code === "none" ? t("noSub") : tLang(code)}
            </option>
          ))}
        </select>
      </label>
      <p className="pb-2 text-xs text-muted">{t("remembered")}</p>
    </div>
  );
}
