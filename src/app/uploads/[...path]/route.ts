import { readFile } from "fs/promises";
import { resolveUploadPath } from "@/lib/upload-path";

/**
 * Serves admin-uploaded covers from UPLOAD_DIR. Served by Next itself (not only by the reverse
 * proxy) because next/image fetches local sources through the app's own router.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const uploadDir = process.env.UPLOAD_DIR;
  if (!uploadDir) return new Response("Not found", { status: 404 });
  const file = resolveUploadPath(uploadDir, (await params).path);
  if (!file) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        // Every upload gets a fresh random name, so the URL never changes content.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
