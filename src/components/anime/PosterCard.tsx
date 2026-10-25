import Image from "next/image";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

type PosterCardProps = {
  href: string;
  title: string;
  coverUrl: string | null;
  meta?: ReactNode;
  tags?: ReactNode;
  // Shown in the top-right corner of the poster (EP n or END, approved plan section 3).
  corner?: ReactNode;
  // Posters are 2:3. The sizes match the grids on the home, schedule and series pages.
  priority?: boolean;
};

export function PosterCard({ href, title, coverUrl, meta, tags, corner, priority = false }: PosterCardProps) {
  return (
    <Link href={href} className="group block space-y-2">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-line bg-raised transition-transform group-hover:-translate-y-0.5">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={title}
            fill
            sizes="(min-width: 768px) 16vw, 33vw"
            className="object-cover"
            priority={priority}
          />
        ) : (
          <span className="flex h-full items-center justify-center p-3 text-center text-xs text-muted">
            {title}
          </span>
        )}
        {corner && <span className="absolute right-1.5 top-1.5 z-10">{corner}</span>}
      </div>
      <div className="space-y-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{title}</p>
        {meta && <p className="text-xs text-muted">{meta}</p>}
        {tags}
      </div>
    </Link>
  );
}
