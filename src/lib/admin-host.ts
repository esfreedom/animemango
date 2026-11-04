// The back office runs on its own host (ADMIN_SITE_URL, for example https://admin.example.com).
// Pages live under /admin-app in the codebase. The proxy rewrites the admin host onto them and
// keeps them off the public host. Pure, so the routing rules can be tested.

export const ADMIN_PREFIX = "/admin-app";

// The Google callback has no locale segment, so it is served as it is on both hosts.
const AUTH_PREFIX = "/auth/";

export type AdminRoute =
  | { kind: "admin"; pathname: string }
  | { kind: "redirect"; url: string }
  | { kind: "not_found" }
  | { kind: "passthrough" }
  | { kind: "public" };

type Input = {
  pathname: string;
  host: string | null;
  adminSiteUrl: string | undefined;
};

// Without ADMIN_SITE_URL the back office is unreachable on every host, which is the safe default.
export function resolveAdminRoute({ pathname, host, adminSiteUrl }: Input): AdminRoute {
  const adminOrigin = parseOrigin(adminSiteUrl);

  if (adminOrigin && host === adminOrigin.host) {
    if (pathname.startsWith(AUTH_PREFIX)) return { kind: "passthrough" };
    const rest = pathname === "/" ? "" : pathname;
    return { kind: "admin", pathname: `${ADMIN_PREFIX}${rest}` };
  }

  if (pathname.startsWith(AUTH_PREFIX)) return { kind: "passthrough" };

  // The admin area must not be served on the public host.
  if (pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)) {
    return { kind: "not_found" };
  }

  // Old public admin links such as /th/admin/studios move to the admin host.
  const legacy = /^\/(?:th|en|ja)\/admin(\/.*)?$/.exec(pathname);
  if (legacy) {
    if (!adminOrigin) return { kind: "not_found" };
    return { kind: "redirect", url: `${adminOrigin.origin}${legacy[1] ?? "/"}` };
  }

  return { kind: "public" };
}

// True when the request arrived on the back-office host. Used where a redirect or a
// session must stay on that host.
export function isAdminHost({ host, adminSiteUrl }: { host: string | null; adminSiteUrl: string | undefined }): boolean {
  const adminOrigin = parseOrigin(adminSiteUrl);
  return Boolean(adminOrigin && host === adminOrigin.host);
}

// The origin of the back office, for example https://admin.example.com. Null when not configured.
export function adminSiteOrigin(adminSiteUrl: string | undefined): string | null {
  return parseOrigin(adminSiteUrl)?.origin ?? null;
}

// The admin link shown in the public header. Empty when the back office is not configured.
export function adminHomeUrl(adminSiteUrl: string | undefined): string | null {
  const origin = adminSiteOrigin(adminSiteUrl);
  return origin ? `${origin}/` : null;
}

function parseOrigin(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
