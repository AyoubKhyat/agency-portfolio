/**
 * Project covers come from two places: the originals shipped in
 * public/projects/ ("/projects/x.webp") and admin uploads stored in Vercel
 * Blob (absolute https URLs). next/image only accepts remote URLs whose host
 * is allowed in next.config.ts, so renderers check with this before handing a
 * src over. Safe to import from client components.
 */
export const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export function isRenderableProjectImage(src: string | null | undefined): src is string {
  if (!src) return false;
  if (src.startsWith("/")) return !src.startsWith("//");
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/* ---------- upload limits (shared by the form and the API) ---------- */

/**
 * Vercel caps a serverless request body at ~4.5 MB, so anything above that
 * never reaches the route. We stop at 4 MB so the failure is a friendly JSON
 * error rather than an opaque 413.
 */
export const MAX_COVER_BYTES = 4 * 1024 * 1024;
export const MAX_COVER_LABEL = "4 MB";

export const ACCEPTED_COVER_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];
export const ACCEPTED_COVER_LABEL = "PNG, JPEG, WebP or AVIF";
