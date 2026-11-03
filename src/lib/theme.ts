// Theme choice shared by the server (the inline script) and the switcher.
export const THEME_STORAGE_KEY = "theme";
export const THEME_CHOICES = ["dark", "light", "system"] as const;
export const DEFAULT_THEME = "dark" as const;
export const THEME_EVENT = "animehub:theme";

export type ThemeChoice = (typeof THEME_CHOICES)[number];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}

// Runs before the first paint, so the page never flashes the wrong theme. It reads only the
// storage key and the fixed list above, and falls back to the default when storage is blocked.
export const themeScript = `(function(){var d=${JSON.stringify(DEFAULT_THEME)};try{var c=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});document.documentElement.dataset.theme=${JSON.stringify([...THEME_CHOICES])}.indexOf(c)>=0?c:d}catch(e){document.documentElement.dataset.theme=d}})();`;
