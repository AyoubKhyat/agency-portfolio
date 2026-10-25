import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getProjectByIdForAdmin,
  getProjectIdBySlug,
  updateProject,
  deleteProject,
  toggleProjectVisibility,
} from "@/lib/dal";
import { logAudit, getClientIp } from "@/lib/audit";
import { findSlugConflict, isUniqueSlugViolation, slugConflict } from "@/lib/project-slug";
import { PROJECT_KINDS, isProjectKind } from "@/lib/project-kind";

const TRANSLATION_FIELDS = [
  "locale", "title", "desc", "tags", "tagline", "metaDesc", "client",
  "industry", "challenge", "solution", "step1Title", "step1Desc",
  "step2Title", "step2Desc", "step3Title", "step3Desc", "features",
  "tech", "result1Value", "result1Label", "result2Value", "result2Label",
  "result3Value", "result3Label", "results",
] as const; // The testimonial has its own endpoint (./testimonial): a project save never writes it.

const VALID_STATUSES = new Set(["DRAFT", "IN_PROGRESS", "REVIEW", "COMPLETED", "PUBLISHED"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await getProjectByIdForAdmin(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Omitted (e.g. an admin tab opened before this field existed): keep the saved classification.
  if (body.kind !== undefined && !isProjectKind(body.kind)) {
    return NextResponse.json({ error: `kind must be one of: ${PROJECT_KINDS.join(", ")}` }, { status: 400 });
  }

  try {
    if (typeof body.slug === "string" && body.slug) {
      const conflict = await findSlugConflict(body.slug, id, getProjectIdBySlug);
      if (conflict) return NextResponse.json({ error: conflict.error }, { status: conflict.status });
    }

    const cleanTranslations = (body.translations || []).map((t: Record<string, unknown>) => {
      const clean: Record<string, string> = {};
      for (const field of TRANSLATION_FIELDS) {
        clean[field] = (t[field] as string) ?? "";
      }
      return clean;
    });

    const status = typeof body.status === "string" && VALID_STATUSES.has(body.status)
      ? body.status
      : undefined;

    const project = await updateProject(id, {
      slug: body.slug,
      category: body.category,
      url: body.url || "",
      image: body.image || "",
      tag: body.tag || "",
      visible: body.visible ?? true,
      status,
      kind: body.kind,
      translations: cleanTranslations,
    });

    // Audit: project updated
    await logAudit({
      userId: session.userId,
      userName: session.fullName,
      action: "UPDATE_PROJECT",
      entity: "project",
      entityId: id,
      details: { slug: body.slug, category: body.category, status, kind: body.kind },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(project);
  } catch (e) {
    if (isUniqueSlugViolation(e)) {
      const conflict = slugConflict(String(body.slug));
      return NextResponse.json({ error: conflict.error }, { status: conflict.status });
    }
    // Prisma messages include query details; log them, never return them.
    console.error("[projects] update failed:", e);
    return NextResponse.json({ error: "Could not save the project. Please try again." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;

  // Fetch project info before deletion for the audit log
  const existing = await getProjectByIdForAdmin(id);

  await deleteProject(id);

  // Audit: project deleted
  await logAudit({
    userId: session.userId,
    userName: session.fullName,
    action: "DELETE_PROJECT",
    entity: "project",
    entityId: id,
    details: { slug: existing?.slug },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await toggleProjectVisibility(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAudit({
    userId: session.userId,
    userName: session.fullName,
    action: "TOGGLE_PROJECT_VISIBILITY",
    entity: "project",
    entityId: id,
    details: { visible: project.visible, slug: project.slug },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json(project);
}
