import type { Metadata } from "next";

// Production origin for canonical URLs, hreflang alternates, the sitemap, robots and structured data.
export const SITE_URL = "https://www.ibda3digital.com";

const LOCALES = ["fr", "en", "ar"] as const;

/** Absolute URL of a localized page; `path` starts with "/" ("" for the locale home). */
export function localeUrl(locale: string, path = "") {
  return `${SITE_URL}/${locale}${path}`;
}

/** Self-referencing canonical + FR/EN/AR (and x-default → FR) alternates for a localized page. */
export function localeAlternates(locale: string, path = "") {
  return {
    canonical: localeUrl(locale, path),
    languages: {
      "x-default": localeUrl("fr", path),
      ...Object.fromEntries(LOCALES.map((l) => [l, localeUrl(l, path)])),
    },
  };
}

const OG_LOCALE: Record<string, string> = { fr: "fr_FR", en: "en_US", ar: "ar_MA" };
const DEFAULT_OG_IMAGE = { url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "Ibda3 Digital" };

/**
 * Page-specific metadata: title, description, canonical + hreflang, and complete Open Graph /
 * Twitter tags (og:url = canonical). Child `openGraph` objects replace the layout's wholesale,
 * so every field is set here rather than inherited.
 */
export function pageMetadata({
  locale,
  path = "",
  title,
  description,
  type = "website",
  image,
  article,
}: {
  locale: string;
  path?: string;
  title: string;
  description: string;
  type?: "website" | "article";
  image?: string;
  article?: { publishedTime?: string; authors?: string[] };
}): Metadata {
  const images = image ? [{ url: image.startsWith("http") ? image : `${SITE_URL}${image}` }] : [DEFAULT_OG_IMAGE];
  return {
    title,
    description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      type,
      url: localeUrl(locale, path),
      siteName: "Ibda3 Digital",
      locale: OG_LOCALE[locale] ?? OG_LOCALE.fr,
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      title,
      description,
      images,
      ...(type === "article" ? article : {}),
    },
    twitter: { card: "summary_large_image", title, description, images: images.map((i) => i.url) },
  };
}
