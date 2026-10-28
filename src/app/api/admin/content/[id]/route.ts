import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireTeam } from "@/lib/authz";
import { prisma, hasPrisma } from "@/lib/prisma";
import { getClientIp, logAudit } from "@/lib/audit";
import { contentUpdateSchema, firstContentError, planContentUpdate } from "@/lib/content-posts";

/**
 * One Content Planner post.
 *   GET   — the post
 *   PATCH — edit fields, change status, record metrics, archive / restore (`archived`)
 * There is no hard delete: removing a post archives it (reversible).
 * Publishing and unpublishing need an explicit confirmation (lib/content-posts) and are audited.
 */

type Params = { params: Promise<{ id: string }> };

async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const post = await prisma.contentPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(post);
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const { session } = auth;

  const { id } = await params;
  const parsed = contentUpdateSchema.safeParse(await readBody(req));
  if (!parsed.success) return NextResponse.json({ error: firstContentError(parsed.error) }, { status: 400 });

  const before = await prisma.contentPost.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const plan = planContentUpdate(before, parsed.data);
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: plan.status });
  if (Object.keys(plan.data).length === 0) return NextResponse.json(before);

  // Only write over the version that was checked: a concurrent edit (e.g. someone else
  // publishing it meanwhile) makes this match nothing instead of being silently overwritten.
  const { count } = await prisma.contentPost.updateMany({
    where: { id, status: before.status, updatedAt: before.updatedAt },
    data: plan.data as Prisma.ContentPostUpdateManyMutationInput,
  });
  if (count === 0) {
    return NextResponse.json({ error: "This post changed while you were editing. Reload and try again." }, { status: 409 });
  }
  const post = await prisma.contentPost.findUnique({ where: { id } });

  if (plan.event && post) {
    await logAudit({
      userId: session.userId,
      userName: session.fullName,
      action: plan.event === "PUBLISHED" ? "CONTENT_PUBLISHED" : "CONTENT_UNPUBLISHED",
      entity: "ContentPost",
      entityId: id,
      details: { title: post.title, publishedUrl: post.publishedUrl, from: before.status, to: post.status },
      ipAddress: getClientIp(req),
    });
  }
  return NextResponse.json(post);
}
