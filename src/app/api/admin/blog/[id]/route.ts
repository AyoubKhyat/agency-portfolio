import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database not available" }, { status: 503 });

  const { id } = await params;
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(post);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database not available" }, { status: 503 });

  const { id } = await params;
  const body = await req.json();

  const allowedFields = [
    "slug", "locale", "title", "excerpt", "content", "category",
    "readTime", "author", "image", "published",
  ] as const;

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  try {
    const post = await prisma.blogPost.update({
      where: { id },
      data,
    });

    await logAudit({
      userId: session.userId,
      userName: session.fullName,
      action: "UPDATE_BLOG_POST",
      entity: "blog_post",
      entityId: id,
      details: { slug: post.slug, locale: post.locale },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(post);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "A post with this slug and locale already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database not available" }, { status: 503 });

  const { id } = await params;

  const existing = await prisma.blogPost.findUnique({ where: { id } });

  await prisma.blogPost.delete({ where: { id } });

  await logAudit({
    userId: session.userId,
    userName: session.fullName,
    action: "DELETE_BLOG_POST",
    entity: "blog_post",
    entityId: id,
    details: { slug: existing?.slug },
    ipAddress: getClientIp(req),
  });

  return NextResponse.json({ success: true });
}
