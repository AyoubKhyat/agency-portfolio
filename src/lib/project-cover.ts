import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { put } from "@vercel/blob";
import {
  ACCEPTED_COVER_LABEL,
  ACCEPTED_COVER_TYPES,
  MAX_COVER_BYTES,
  MAX_COVER_LABEL,
} from "@/lib/project-image";

/** Covers render at up to 1280×800; anything this small would look blurry. */
const MIN_COVER_WIDTH = 640;
const MIN_COVER_HEIGHT = 400;
/** Refuse decompression bombs before sharp allocates the full bitmap. */
const MAX_INPUT_PIXELS = 50_000_000;
const BLOB_UPLOAD_TIMEOUT_MS = 20_000;
/** sharp reports AVIF as "heif". */
const ACCEPTED_FORMATS = new Set(["png", "jpeg", "webp", "heif"]);

/** A failure whose message is safe and useful to show the admin. */
export class CoverUploadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Cheap checks on what the browser declared, before reading the bytes.
 * The real format is verified by sharp in convertCover.
 */
export function checkCoverFile(file: File): void {
  if (file.size === 0) {
    throw new CoverUploadError("That file is empty. Please choose an image.", 400);
  }
  if (file.size > MAX_COVER_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new CoverUploadError(`That image is ${mb} MB. The maximum is ${MAX_COVER_LABEL}.`, 413);
  }
  if (file.type && !ACCEPTED_COVER_TYPES.includes(file.type)) {
    throw new CoverUploadError(`Only ${ACCEPTED_COVER_LABEL} images are allowed.`, 415);
  }
}

/** Sniff the real bytes, then resize/crop to 1280×800 WebP. */
export async function convertCover(input: Buffer): Promise<Buffer> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new CoverUploadError(`That file is not a readable image. Please upload a ${ACCEPTED_COVER_LABEL} file.`, 415);
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new CoverUploadError(`Only ${ACCEPTED_COVER_LABEL} images are allowed.`, 415);
  }

  // EXIF orientations 5–8 are rotated 90°, so width and height swap on display.
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = (rotated ? meta.height : meta.width) ?? 0;
  const height = (rotated ? meta.width : meta.height) ?? 0;
  if (width * height > MAX_INPUT_PIXELS) {
    throw new CoverUploadError(`That image is ${width}×${height}, which is too large to process.`, 413);
  }
  if (width < MIN_COVER_WIDTH || height < MIN_COVER_HEIGHT) {
    throw new CoverUploadError(
      `That image is ${width}×${height}. Covers must be at least ${MIN_COVER_WIDTH}×${MIN_COVER_HEIGHT}.`,
      422,
    );
  }

  try {
    return await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(1280, 800, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new CoverUploadError("That image could not be converted. Try exporting it again as PNG or JPEG.", 422);
  }
}

/** Blob is configured either by a read-write token or by OIDC + store id. */
export function coverStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

/**
 * Persist the WebP and return the value to store in Project.image.
 *
 * Vercel's filesystem is read-only, so production needs a Blob store. Local
 * dev without one keeps the old behaviour of writing into public/projects/.
 */
export async function storeCover(webp: Buffer, baseName: string): Promise<string> {
  if (coverStorageConfigured()) {
    // The SDK retries 5xx responses up to 10 times with exponential backoff
    // (minutes in total) and only checks the abort signal between attempts,
    // so race it against our own deadline as well.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BLOB_UPLOAD_TIMEOUT_MS);
    try {
      const blob = await Promise.race([
        put(`projects/${baseName}.webp`, webp, {
          access: "public",
          contentType: "image/webp",
          // A fresh URL per upload: replacing a cover never serves a stale cached copy.
          addRandomSuffix: true,
          abortSignal: controller.signal,
        }),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () =>
            reject(new Error(`timed out after ${BLOB_UPLOAD_TIMEOUT_MS / 1000}s`)),
          );
        }),
      ]);
      return blob.url;
    } catch (err) {
      console.error("[upload] Vercel Blob put failed:", err instanceof Error ? err.message : err);
      throw new CoverUploadError("The image could not be saved to storage. Please try again.", 502);
    } finally {
      clearTimeout(timer);
    }
  }

  if (process.env.VERCEL) {
    console.error("[upload] No Blob store configured (BLOB_READ_WRITE_TOKEN / BLOB_STORE_ID missing)");
    throw new CoverUploadError("Image storage is not configured on the server. The image was not saved.", 503);
  }

  const fileName = `${baseName}.webp`;
  const outDir = path.join(process.cwd(), "public", "projects");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, fileName), webp);
  return `/projects/${fileName}`;
}
