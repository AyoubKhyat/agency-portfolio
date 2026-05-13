import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getProjectByIdForAdmin,
  updateProject,
  deleteProject,
  toggleProjectVisibility,
} from "@/lib/dal";

const TRANSLATION_FIELDS = [
  "locale", "title", "desc", "tags", "tagline", "metaDesc", "client",
  "industry", "challenge", "solution", "step1Title", "step1Desc",
  "step2Title", "step2Desc", "step3Title", "step3Desc", "features",
  "tech", "result1Value", "result1Label", "result2Value", "result2Label",
  "result3Value", "result3Label",
] as const;

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

    const project = await updateProject(id, {
      slug: body.slug,
      category: body.category,
      url: body.url || "",
      image: body.image || "",
      tag: body.tag || "",
      visible: body.visible ?? true,
      translations: cleanTranslations,
    });
    return NextResponse.json(project);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteProject(id);
  return NextResponse.json({ success: true });
}

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await toggleProjectVisibility(id);
  return NextResponse.json(project);
}
