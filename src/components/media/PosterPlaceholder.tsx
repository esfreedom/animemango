type PosterPlaceholderProps = {
  label: string;
};

// Posters use the 2:3 standard ratio from DESIGN.md (section 6).
export function PosterPlaceholder({ label }: PosterPlaceholderProps) {
  return (
    <div className="flex aspect-[2/3] items-end rounded-lg border border-line bg-surface p-2 text-xs text-muted">
      {label}
    </div>
  );
}
