import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "opengraph.githubassets.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
  // Private areas: never indexed, even if a URL leaks.
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/admin/:path*", headers: noindex },
      { source: "/sign/:path*", headers: noindex },
    ];
  },
};

export default withNextIntl(nextConfig);
