import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { resolveAdminRoute } from "@/lib/admin-host";

const intl = createMiddleware(routing);

// The admin host is rewritten onto the back-office pages. The public host goes through next-intl.
export default function proxy(request: NextRequest) {
  const route = resolveAdminRoute({
    pathname: request.nextUrl.pathname,
    host: request.headers.get("host"),
    adminSiteUrl: process.env.ADMIN_SITE_URL,
  });

  if (route.kind === "admin") {
    const url = request.nextUrl.clone();
    url.pathname = route.pathname;
    return NextResponse.rewrite(url);
  }
  if (route.kind === "passthrough") {
    return NextResponse.next();
  }
  if (route.kind === "redirect") {
    return NextResponse.redirect(route.url, 308);
  }
  if (route.kind === "not_found") {
    return new NextResponse("Not found", { status: 404 });
  }
  return intl(request);
}

export const config = {
  // Skip API routes, Next.js internals and static files (anything with a dot).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
