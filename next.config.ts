import type { NextConfig } from "next";

// Points next-intl at the request config. This is the alias that the
// `next-intl/plugin` would set up. The plugin is not used because it loads
// @swc/core on import, which fails on machines where the SWC native cache
// cannot be validated (seen on Windows with restrictive ACLs).
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Posters and banners come from the AniList CDN, as returned by the API.
    remotePatterns: [{ protocol: "https", hostname: "s4.anilist.co" }],
  },
  turbopack: {
    resolveAlias: {
      "next-intl/config": "./src/i18n/request.ts",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
