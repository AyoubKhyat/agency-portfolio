/**
 * Links between Find businesses and Check a website. Client-safe (no server imports).
 * The link only pre-fills the address: Check a website never runs a check until a person presses Check.
 */
import { SITE_URL_MAX } from "@/lib/diagnosis";

export const QUALIFY_PATH = "/admin/qualify";

/** An http(s) address within the length limit, or null. Anything else (javascript:, data:, relative) is refused. */
function webAddress(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value || value.length > SITE_URL_MAX) return null;
  try {
    const u = new URL(value);
    return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password ? value : null;
  } catch {
    return null;
  }
}

/** "/admin/qualify?url=<encoded address>" for a business's site, or null when the address isn't a web address. */
export function fullCheckHref(site: string | null | undefined): string | null {
  const url = webAddress(site);
  return url ? `${QUALIFY_PATH}?url=${encodeURIComponent(url)}` : null;
}

/** The address to pre-fill from a "?url=…" query string, or "" when there is none or it isn't a web address. */
export function prefillUrl(search: string): string {
  return webAddress(new URLSearchParams(search).get("url")) ?? "";
}
