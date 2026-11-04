import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/admin-app", "/notifications", "/login", "/auth/"] }],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
