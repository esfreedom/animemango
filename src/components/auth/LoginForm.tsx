"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { sendSignInLink } from "@/actions/auth";
import type { ActionResult } from "@/actions/shared";

async function submit(previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return sendSignInLink(previous, formData);
}

const KNOWN = ["invalid_email", "not_configured", "send_failed"] as const;

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState(submit, null);

  const errorKey = state && !state.ok ? state.error : null;
  const errorText = errorKey
    ? (KNOWN as readonly string[]).includes(errorKey)
      ? t(`errors.${errorKey}` as "errors.send_failed")
      : t("errors.send_failed")
    : null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <label className="flex flex-col gap-1 text-sm text-muted">
        {t("email")}
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="h-10 rounded-md border border-line bg-surface px-3 text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-full rounded-md bg-accent px-4 font-semibold text-on-accent disabled:opacity-60"
      >
        {t("send")}
      </button>
      {state?.ok && <p role="status" className="text-sm text-ink">{t("sent")}</p>}
      {errorText && <p role="alert" className="text-sm text-accent">{errorText}</p>}
    </form>
  );
}
