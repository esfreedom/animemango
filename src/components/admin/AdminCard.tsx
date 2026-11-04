import type { ReactNode } from "react";
import { panelClass } from "./styles";

type AdminCardProps = {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
};

// One panel per task in the back office. The title is the anchor for the sidebar and for links.
export function AdminCard({ id, title, description, children }: AdminCardProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`${panelClass} scroll-mt-4`}>
      <header className="space-y-1 border-b border-line px-4 py-3">
        <h2 id={`${id}-title`} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {description && <p className="text-xs text-muted">{description}</p>}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}
