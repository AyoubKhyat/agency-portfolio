import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import {
  DOCUMENT_LANGUAGES,
  DOCUMENT_METADATA_SELECT,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  documentMetadataSchema,
  firstZodMessage,
  formDataToMetadata,
  PDF_MIME,
  sanitizeFileName,
  validatePdfUpload,
} from "@/lib/documents";

/** Uploads carry a binary body — keep this off the edge runtime. */
export const runtime = "nodejs";

/* ============================================================
 * GET /api/admin/documents
 * Paginated metadata list. Never touches DocumentFile.
 * ============================================================ */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) {
    return NextResponse.json({ documents: [], total: 0, pages: 1, counts: {} });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") || "").trim();
  const type = searchParams.get("type");
  const language = searchParams.get("language");
  const status = searchParams.get("status");
  const includeArchived = searchParams.get("archived") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10) || 25));

  const where: Record<string, unknown> = {};

  // Archived documents are hidden unless explicitly asked for.
  where.archivedAt = includeArchived ? { not: null } : null;

  if (type && (DOCUMENT_TYPES as readonly string[]).includes(type)) where.type = type;
  if (language && (DOCUMENT_LANGUAGES as readonly string[]).includes(language)) where.language = language;
  if (status && (DOCUMENT_STATUSES as readonly string[]).includes(status)) where.status = status;

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } },
      { projectName: { contains: search, mode: "insensitive" } },
      { fileName: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const [documents, total, archivedCount] = await Promise.all([
      prisma.document.findMany({
        where,
        select: DOCUMENT_METADATA_SELECT,
        orderBy: { createdAt: "desc" }, // newest first
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.document.count({ where }),
      prisma.document.count({ where: { archivedAt: { not: null } } }),
    ]);

    return NextResponse.json({
      documents,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      archivedCount,
    });
  } catch (err) {
    console.error("[documents] list failed:", err);
    return NextResponse.json({ error: "Could not load documents." }, { status: 500 });
  }
}

/* ============================================================
 * POST /api/admin/documents
 * multipart/form-data: metadata fields + `file`.
 *
 * The metadata row and the bytes are written by a single nested
 * create, which Prisma runs in one transaction — so a failed
 * upload can never leave a document row without its file.
 * ============================================================ */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

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
  const fileCheck = validatePdfUpload(file, buffer);
  if (!fileCheck.ok) {
    return NextResponse.json({ error: fileCheck.error }, { status: 400 });
  }

  const parsed = documentMetadataSchema.safeParse(formDataToMetadata(formData));
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 400 });
  }
  const meta = parsed.data;

  // A relation is only stored if the referenced row actually exists, so the
  // "open related client/project" link can never dangle.
  const clientId = await resolveClientId(meta.clientId);
  const projectId = await resolveProjectId(meta.projectId);

  try {
    const created = await prisma.document.create({
      data: {
        title: meta.title,
        clientName: meta.clientName,
        clientId,
        projectName: meta.projectName,
        projectId,
        type: meta.type,
        language: meta.language,
        status: meta.status,
        documentDate: meta.documentDate,
        amount: meta.amount,
        currency: meta.currency,
        notes: meta.notes,
        fileName: sanitizeFileName(file.name),
        fileSize: buffer.length,
        createdById: session.userId,
        createdByName: session.fullName,
        file: {
          create: { data: buffer, mimeType: PDF_MIME },
        },
      },
      select: DOCUMENT_METADATA_SELECT,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[documents] create failed:", err);
    return NextResponse.json(
      { error: "Could not save the document. Nothing was stored." },
      { status: 500 },
    );
  }
}

/* ---------- relation guards ---------- */

async function resolveClientId(id: string | null): Promise<string | null> {
  if (!id) return null;
  const found = await prisma.client.findUnique({ where: { id }, select: { id: true } });
  return found?.id ?? null;
}

async function resolveProjectId(id: string | null): Promise<string | null> {
  if (!id) return null;
  const found = await prisma.clientProject.findUnique({ where: { id }, select: { id: true } });
  return found?.id ?? null;
}
