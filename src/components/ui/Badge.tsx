import type { ReactNode } from "react";

type BadgeProps = { children: ReactNode; tone?: "neutral" | "accent" };

// Text labels, never color alone (DESIGN.md section 11).
export function Badge({ children, tone = "neutral" }: BadgeProps) {
  const toneClass = tone === "accent" ? "bg-accent text-on-accent" : "bg-raised text-muted";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold leading-none ${toneClass}`}>
      {children}
    </span>
  );
}
