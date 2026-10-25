import type { ReactNode } from "react";

type SectionProps = {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

export function Section({ id, title, action, children }: SectionProps) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h2 id={id} className="text-xl font-semibold text-ink">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
