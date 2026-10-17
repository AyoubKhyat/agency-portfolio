import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /_next/ must stay crawlable (CSS/JS/images needed to render pages). Admin and contract-signing
      // pages are not disallowed here: they send X-Robots-Tag: noindex (next.config.ts), which crawlers
      // can only see if they are allowed to fetch the page.
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
