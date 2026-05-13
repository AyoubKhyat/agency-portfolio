import type { MetadataRoute } from "next";
import { getAllProjectSlugs } from "@/lib/dal";

const BASE_URL = "https://ibda3-digital.vercel.app";
const locales = ["fr", "en", "ar"];
const pages = ["", "/services", "/portfolio", "/blog", "/about", "/contact"];
const serviceSlugs = ["web", "ecommerce", "mobile", "seo", "maintenance"];

function entry(
  path: string,
  freq: "daily" | "weekly" | "monthly",
  priority: number,
): MetadataRoute.Sitemap[number] {
  const alternates: Record<string, string> = {
    "x-default": `${BASE_URL}/fr${path}`,
  };
  for (const locale of locales) {
    alternates[locale] = `${BASE_URL}/${locale}${path}`;
  }
  return {
    url: `${BASE_URL}/fr${path}`,
    lastModified: new Date(),
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

  const projectSlugs = await getAllProjectSlugs();
  for (const slug of projectSlugs) {
    entries.push(entry(`/portfolio/${slug}`, "monthly", 0.8));
  }

  return entries;
}
