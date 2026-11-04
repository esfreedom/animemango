// Shared classes for the back office. Dense, table-first styling, separate from the public site.
export const ADMIN_LOCALE = "th" as const;

export const inputClass =
  "h-9 min-w-0 rounded-md border border-line bg-canvas px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus";
export const selectClass = inputClass;
export const buttonClass =
  "h-9 whitespace-nowrap rounded-md border border-line px-3 text-sm text-ink hover:bg-raised";
export const primaryClass =
  "h-9 whitespace-nowrap rounded-md bg-accent px-3 text-sm font-semibold text-on-accent hover:opacity-90";
export const tableClass = "w-full border-collapse text-left text-sm";
export const thClass = "border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted";
export const tdClass = "border-b border-line px-3 py-2 align-top text-ink";
export const panelClass = "rounded-md border border-line bg-surface";
