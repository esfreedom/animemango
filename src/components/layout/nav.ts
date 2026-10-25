// Order matters: the mobile bottom bar shows the first four entries. The season link
// goes through /season/current, which redirects to the current season, so the header
// stays static and does not read the clock.
export const navItems = [
  { key: "home", href: "/" },
  { key: "schedule", href: "/schedule" },
  { key: "season", href: "/season/current" },
  { key: "search", href: "/search" },
] as const;
