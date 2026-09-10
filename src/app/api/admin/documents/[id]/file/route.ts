import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { contentDisposition, PDF_MIME } from "@/lib/documents";

export const runtime = "nodejs";

/* ============================================================
 * GET /api/admin/documents/[id]/file?mode=inline|download
 *
 * The only route that reads DocumentFile.data. Files live in
 * Postgres, never in public/, so this session check is the sole
 * way to reach the bytes — there is no static URL to guess.
 * ============================================================ */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") === "download" ? "attachment" : "inline";

  const doc = await prisma.document.findUnique({
    where: { id },
    select: {
      fileName: true,
      file: { select: { data: true, mimeType: true } },
    },
  });

  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  if (!doc.file) {
    // Defensive: nested writes make this unreachable, but a missing blob must
    // never render as a broken viewer with no explanation.
    return NextResponse.json(
      { error: "This document has no file attached." },
      { status: 404 },
    );
  }

  const bytes = Buffer.from(doc.file.data);

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      // Pinned to PDF regardless of what is stored, so a mislabelled row can
      // never coax the browser into treating the body as HTML or script.
      "Content-Type": PDF_MIME,
      "Content-Length": String(bytes.length),
      "Content-Disposition": contentDisposition(mode, doc.fileName),
      "X-Content-Type-Options": "nosniff",
      // Private material: keep it out of shared caches and off disk.
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}
