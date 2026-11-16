import type { MetadataRoute } from "next";
import { getSitemapProjects } from "@/lib/dal";
import { getAllPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/site";
import { DETAIL_PAGE_IDS } from "@/lib/services-catalog";

// Built from the database on each request: a static sitemap would freeze the project list at build time.
export const dynamic = "force-dynamic";

const BASE_URL = SITE_URL;
const locales = ["fr", "en", "ar"];
const pages = ["", "/services", "/portfolio", "/blog", "/about", "/contact"];
const serviceSlugs = DETAIL_PAGE_IDS; // service detail pages, from the shared catalog

/**
 * lastModified only where a real change date exists (a project's or a DB post's updatedAt, a post's front matter).
 * Static and service pages have none, so they have no <lastmod>: never the time of the request.
 */
function entry(
  path: string,
  freq: "daily" | "weekly" | "monthly",
  priority: number,
  lastModified?: Date | string | null,
): MetadataRoute.Sitemap[number] {
  const alternates: Record<string, string> = {
    "x-default": `${BASE_URL}/fr${path}`,
  };
  for (const locale of locales) {
    alternates[locale] = `${BASE_URL}/${locale}${path}`;
  }
  return {
    url: `${BASE_URL}/fr${path}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency: freq,
    priority,
    alternates: { languages: alternates },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    const priority = page === "" ? 1.0 : page === "/services" ? 0.9 : 0.8;
    const freq = page === "" ? "weekly" : "monthly";
    entries.push(entry(page, freq, priority));
  }

  for (const slug of serviceSlugs) {
    entries.push(entry(`/services/${slug}`, "monthly", 0.85));
  }

  for (const project of await getSitemapProjects()) {
    entries.push(entry(`/portfolio/${project.slug}`, "monthly", 0.8, project.lastModified));
  }

  for (const post of await getAllPosts("fr")) {
    entries.push(entry(`/blog/${post.slug}`, "monthly", 0.75, post.lastModified));
  }

  return entries;
}
