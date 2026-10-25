"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { reportComment } from "@/actions/comments";
import type { ActionResult } from "@/actions/shared";

async function submit(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return reportComment(formData);
}

export function ReportButton({ commentId }: { commentId: string }) {
  const t = useTranslations("comments");
  const [state, action, pending] = useActionState(submit, null);

  if (state?.ok) return <span role="status" className="text-xs text-muted">{t("reported")}</span>;

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="commentId" value={commentId} />
      <label className="sr-only" htmlFor={`report-${commentId}`}>
        {t("reportReason")}
      </label>
      <input
        id={`report-${commentId}`}
        name="reason"
        required
        minLength={3}
        maxLength={300}
        placeholder={t("reportReason")}
        className="h-7 w-40 rounded border border-line bg-surface px-2 text-xs text-ink"
      />
      <button type="submit" disabled={pending} className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
        {t("report")}
      </button>
    </form>
  );
}
