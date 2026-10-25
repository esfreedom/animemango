import { routing } from "@/i18n/routing";

export type ActionResult = { ok: true } | { ok: false; error: string };

export function parseLocale(value: FormDataEntryValue | null): string {
  const candidate = String(value ?? "");
  return (routing.locales as readonly string[]).includes(candidate) ? candidate : routing.defaultLocale;
}

// FormData values are strings. Empty strings become undefined.
export function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
