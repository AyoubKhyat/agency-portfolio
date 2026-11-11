/**
 * Uploads the private Marrakech business list to a PRIVATE Vercel Blob store. Manual; dry run unless --apply.
 *
 * One-time setup (needs approval: it changes production settings):
 *   1. vercel blob create-store ibda3-osm-private --access private   (Hobby: free within the Blob limits)
 *      Do not connect it under the default prefix: BLOB_READ_WRITE_TOKEN already belongs to the public covers store.
 *   2. Copy that store's read-write token into the project's Production env as OSM_BLOB_READ_WRITE_TOKEN
 *      (server-only; never NEXT_PUBLIC_). Redeploy for it to take effect.
 *
 * Each refresh:
 *   npm run osm:marrakech -- --pbf <morocco-latest.osm.pbf>        (writes data/osm/marrakech-businesses.json)
 *   OSM_BLOB_READ_WRITE_TOKEN=... npm run osm:upload                 (dry run: checks the file, uploads nothing)
 *   OSM_BLOB_READ_WRITE_TOKEN=... npm run osm:upload -- --apply      (uploads; servers pick it up within an hour)
 *
 * The token is read from the environment only and never printed; neither is the blob URL.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { BLOB_PATHNAME, BLOB_TOKEN_ENV, DATASET_FILE, parseDataset } from "../../src/lib/osm-dataset";

const apply = process.argv.includes("--apply");
const file = path.resolve(DATASET_FILE);

async function main() {
  const text = readFileSync(file, "utf8");
  const data = parseDataset(text); // refuses a malformed file before anything is sent
  const token = process.env[BLOB_TOKEN_ENV];
  console.log(`${data.entries.length} businesses · ${(Buffer.byteLength(text) / 1024).toFixed(1)} KB · OSM data until ${data.osmDataUntil ?? "unknown"}`);
  console.log(`Target: private Blob, pathname ${BLOB_PATHNAME} · token ${token ? "present" : `missing (${BLOB_TOKEN_ENV})`}`);
  if (!apply) { console.log("Dry run: nothing uploaded. Add --apply to upload."); return; }
  if (!token) throw new Error(`${BLOB_TOKEN_ENV} is not set`);

  const { put, del } = await import("@vercel/blob");
  const r = await put(BLOB_PATHNAME, text, {
    access: "private", token, contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
  });
  if (!new URL(r.url).hostname.includes(".private.")) {
    await del(r.url, { token }); // belt and braces: never leave the list in a public store
    throw new Error("That token belongs to a public store. The upload was deleted again.");
  }
  console.log(`Uploaded ${BLOB_PATHNAME} (private).`);
}

main().catch((err) => {
  console.error(`Upload failed: ${err instanceof Error ? err.message.replace(/vercel_blob_rw_\w+/g, "[token]") : "unknown error"}`);
  process.exit(1);
});
