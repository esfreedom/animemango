import type { NextConfig } from "next";

// Points next-intl at the request config. This is the alias that the
// `next-intl/plugin` would set up. The plugin is not used because it loads
// @swc/core on import, which fails on machines where the SWC native cache
// cannot be validated (seen on Windows with restrictive ACLs).
const nextConfig: NextConfig = {
  // Off on purpose. With Cache Components on, Workers requests hang on Cloudflare (OpenNext).
  // Pages are rendered per request, and data is read from the database every time.
  cacheComponents: false,
  images: {
    // Posters and banners come from the AniList CDN, as returned by the API.
    remotePatterns: [
      { protocol: "https", hostname: "s4.anilist.co" },
      // Google profile pictures, returned by Supabase on sign-in.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
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
