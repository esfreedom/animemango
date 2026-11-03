"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  DEFAULT_THEME,
  isThemeChoice,
  THEME_CHOICES,
  THEME_EVENT,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from "@/lib/theme";

// The stored choice is read from localStorage, so every switcher and every tab stays in sync.
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

function getSnapshot(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeChoice(stored)) return stored;
  } catch {
    // Storage can be blocked. The default still applies.
  }
  return DEFAULT_THEME;
}

function getServerSnapshot(): ThemeChoice {
  return DEFAULT_THEME;
}

function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = choice;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // The choice still applies to this page when storage is blocked.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function ThemeSwitcher() {
  const t = useTranslations("theme");
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <select
      aria-label={t("label")}
      value={choice}
      onChange={(event) => applyTheme(event.target.value as ThemeChoice)}
      className="h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink"
    >
      {THEME_CHOICES.map((option) => (
        <option key={option} value={option}>
          {t(option)}
        </option>
      ))}
    </select>
  );
}
