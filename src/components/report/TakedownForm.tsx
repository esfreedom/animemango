"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/actions/shared";
import { submitTakedown } from "@/actions/community";

async function submit(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return submitTakedown(formData);
}

export function TakedownForm() {
  const t = useTranslations("report");
  const [state, action, pending] = useActionState(submit, null);

  if (state?.ok) return <p role="status" className="text-sm text-ink">{t("success")}</p>;

  return (
    <form action={action} className="space-y-4">
      <label className="flex flex-col gap-1 text-sm text-muted">
        {t("name")}
        <input name="requesterName" required minLength={2} className="h-10 rounded-md border border-line bg-surface px-3 text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        {t("email")}
        <input type="email" name="requesterEmail" required className="h-10 rounded-md border border-line bg-surface px-3 text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        {t("url")}
        <input type="url" name="url" required className="h-10 rounded-md border border-line bg-surface px-3 text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        {t("reason")}
        <textarea name="reason" required minLength={10} rows={5} className="rounded-md border border-line bg-surface px-3 py-2 text-ink" />
      </label>
      <button type="submit" disabled={pending} className="h-10 w-full rounded-md bg-accent px-4 font-semibold text-on-accent disabled:opacity-60">
        {t("submit")}
      </button>
      {state && !state.ok && <p role="alert" className="text-sm text-accent">{t("error")}</p>}
    </form>
  );
}
