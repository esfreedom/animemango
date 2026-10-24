// `ready` routes exist; the others render as "coming soon" until their phase ships.
export const navItems = [
  { key: "home", href: "/", ready: true },
  { key: "schedule", href: "/schedule", ready: false },
  { key: "season", href: "/season", ready: false },
  { key: "search", href: "/search", ready: false },
] as const;
