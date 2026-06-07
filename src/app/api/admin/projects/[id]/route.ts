import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getProjectByIdForAdmin,
  updateProject,
  deleteProject,
  toggleProjectVisibility,
} from "@/lib/dal";
import { logAudit, getClientIp } from "@/lib/audit";

const TRANSLATION_FIELDS = [
  "locale", "title", "desc", "tags", "tagline", "metaDesc", "client",
  "industry", "challenge", "solution", "step1Title", "step1Desc",
  "step2Title", "step2Desc", "step3Title", "step3Desc", "features",
  "tech", "result1Value", "result1Label", "result2Value", "result2Label",
  "result3Value", "result3Label", "results", "testimonial",
] as const;

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
  const body = await req.json();

  try {
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
      translations: cleanTranslations,
    });

    // Audit: project updated
    await logAudit({
      userId: session.userId,
      userName: session.fullName,
      action: "UPDATE_PROJECT",
      entity: "project",
      entityId: id,
      details: { slug: body.slug, category: body.category, status },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(project);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
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
