import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en", "ar"],
  defaultLocale: "fr",
  // The pages declare canonical and hreflang themselves (x-default → /fr…). The middleware's own Link header
  // would add a second, different set (x-default → the unprefixed URL), so it stays off.
  alternateLinks: false,
});
