import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import {
  DOCUMENT_METADATA_SELECT,
  PDF_MIME,
  sanitizeFileName,
  validatePdfUpload,
} from "@/lib/documents";

export const runtime = "nodejs";

/* ============================================================
 * POST /api/admin/documents/[id]/replace
 * multipart/form-data with a single `file`.
 *
 * Swaps the PDF while keeping all metadata and the document id,
 * so existing links keep working. The bytes and the fileName /
 * fileSize columns move together in one nested write, so a
 * rejected upload leaves the previous file completely intact.
 * ============================================================ */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const { id } = await params;
  const existing = await prisma.document.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Upload failed — the file may be too large." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Please attach a PDF file." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const check = validatePdfUpload(file, buffer);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  try {
    const updated = await prisma.document.update({
      where: { id },
      data: {
        fileName: sanitizeFileName(file.name),
        fileSize: buffer.length,
        file: {
          // upsert rather than update: heals a row whose blob went missing
          // instead of failing the replace outright.
          upsert: {
            create: { data: buffer, mimeType: PDF_MIME },
            update: { data: buffer, mimeType: PDF_MIME },
          },
        },
      },
      select: DOCUMENT_METADATA_SELECT,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[documents] replace failed:", err);
    return NextResponse.json(
      { error: "Could not replace the file. The existing file was left unchanged." },
      { status: 500 },
    );
  }
}
