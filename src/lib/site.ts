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
