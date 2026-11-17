/**
 * Where the outreach "Next-city recommendation" button goes. Find businesses only covers the private
 * Marrakech list, so Marrakech opens it; any other city keeps the legacy Prospect Discovery sweep
 * (the same link and label as before). Pure, so both cases can be tested without a browser.
 */
export const FIND_BUSINESSES_PATH = "/admin/batch-discovery";
export const LEGACY_SWEEP_PATH = "/admin/prospect-discovery";

export function nextCitySweepLink(city: { key: string; label: string }): { href: string; label: string } {
  return city.key.trim().toUpperCase() === "MARRAKECH"
    ? { href: FIND_BUSINESSES_PATH, label: "Find more Marrakech businesses" }
    : { href: LEGACY_SWEEP_PATH, label: `Open Discovery to sweep ${city.label}` };
}
