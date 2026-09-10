import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import {
  DOCUMENT_METADATA_SELECT,
  documentPatchSchema,
  firstZodMessage,
} from "@/lib/documents";

export const runtime = "nodejs";

/** Hard delete is irreversible, so the client must say so in as many words. */
const HARD_DELETE_TOKEN = "PERMANENT_DELETE";

/* ============================================================
 * GET — single document's metadata. Bytes are never included.
 * ============================================================ */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    select: DOCUMENT_METADATA_SELECT,
  });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  return NextResponse.json(doc);
}

/* ============================================================
 * PATCH — edit metadata, and archive / restore.
 *
 * `archived: true`  → soft archive (reversible, the normal removal)
 * `archived: false` → restore
 * ============================================================ */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const { id } = await params;

  const existing = await prisma.document.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = documentPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 400 });
  }

  const { archived, clientId, projectId, ...rest } = parsed.data;

  // Only copy through fields the caller actually sent — `undefined` keys are
  // dropped so a partial edit never blanks a column it didn't mention.
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) data[key] = value;
  }

  if (clientId !== undefined) data.clientId = await resolveClientId(clientId);
  if (projectId !== undefined) data.projectId = await resolveProjectId(projectId);
  if (archived !== undefined) data.archivedAt = archived ? new Date() : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.document.update({
      where: { id },
      data,
      select: DOCUMENT_METADATA_SELECT,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[documents] update failed:", err);
    return NextResponse.json({ error: "Could not update the document." }, { status: 500 });
  }
}

/* ============================================================
 * DELETE — permanent. Requires ?confirm=PERMANENT_DELETE.
 * Archiving is the normal removal path; this drops the bytes too
 * (DocumentFile cascades) and cannot be undone.
 * ============================================================ */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("confirm") !== HARD_DELETE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Permanent deletion must be confirmed. Archive the document instead if you may need it later.",
      },
      { status: 400 },
    );
  }

  const { id } = await params;
  const existing = await prisma.document.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  try {
    // onDelete: Cascade on DocumentFile removes the bytes with the row.
    await prisma.document.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[documents] delete failed:", err);
    return NextResponse.json({ error: "Could not delete the document." }, { status: 500 });
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
