"use client";

import { useTranslations } from "next-intl";

const STORAGE_KEY = "theme";

export function ThemeToggle() {
  const t = useTranslations("theme");

  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode). The theme still switches for this page.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("toggle")}
      title={t("toggle")}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink hover:bg-raised"
    >
      <span aria-hidden="true">◐</span>
    </button>
  );
}
