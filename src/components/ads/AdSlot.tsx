// Ads are off by default. A slot renders only when NEXT_PUBLIC_ADS_ENABLED=true and
// the viewer has accepted ad cookies. No ad network script is loaded here, so
// nothing is served until the ad network has approved the site (DESIGN.md section 14).
export function AdSlot({ label, consent }: { label: string; consent: boolean }) {
  if (process.env.NEXT_PUBLIC_ADS_ENABLED !== "true" || !consent) return null;

  return (
    <aside aria-label={label} className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">
      {label}
    </aside>
  );
}
