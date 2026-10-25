"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { postComment } from "@/actions/comments";
import type { ActionResult } from "@/actions/shared";

type CommentFormProps = {
  threadId: string;
  parentId?: string;
  compact?: boolean;
};

async function submit(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return postComment(formData);
}

const KNOWN_ERRORS = [
  "sign_in_required",
  "invalid_body",
  "rate_limited",
  "thread_locked",
  "thread_not_found",
  "parent_not_found",
] as const;

export function CommentForm({ threadId, parentId, compact = false }: CommentFormProps) {
  const t = useTranslations("comments");
  const tLang = useTranslations("lang");
  const [state, action, pending] = useActionState(submit, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const errorKey = state && !state.ok ? state.error : null;
  const errorText = errorKey
    ? (KNOWN_ERRORS as readonly string[]).includes(errorKey)
      ? t(`errors.${errorKey}` as "errors.generic")
      : t("errors.generic")
    : null;

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="threadId" value={threadId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <label className="sr-only" htmlFor={`body-${parentId ?? "root"}`}>
        {t("placeholder")}
      </label>
      <textarea
        id={`body-${parentId ?? "root"}`}
        name="body"
        required
        maxLength={2000}
        rows={compact ? 2 : 3}
        placeholder={t("placeholder")}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-focus"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="lang"
          aria-label={t("langTag")}
          defaultValue=""
          className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
        >
          <option value="">{t("langAuto")}</option>
          <option value="th">TH</option>
          <option value="en">EN</option>
          <option value="ja">JP</option>
          <option value="other">{tLang("other")}</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60"
        >
          {t("post")}
        </button>
        {state?.ok && <span role="status" className="text-sm text-muted">{t("posted")}</span>}
        {errorText && <span role="alert" className="text-sm text-accent">{errorText}</span>}
      </div>
    </form>
  );
}
