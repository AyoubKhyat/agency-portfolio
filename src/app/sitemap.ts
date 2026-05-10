import type { MetadataRoute } from "next";

const BASE_URL = "https://ibda3-digital.vercel.app";
const locales = ["fr", "en", "ar"];
const pages = ["", "/services", "/portfolio", "/blog", "/about", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    for (const locale of locales) {
      const url = `${BASE_URL}/${locale}${page}`;
      const alternates: Record<string, string> = {};
      for (const alt of locales) {
        alternates[alt] = `${BASE_URL}/${alt}${page}`;
      }

      entries.push({
        url,
        lastModified: new Date(),
        changeFrequency: page === "" ? "weekly" : "monthly",
        priority: page === "" ? 1 : page === "/services" ? 0.9 : 0.8,
        alternates: { languages: alternates },
      });
    }
  }

  return entries;
}
