import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { logAudit, getClientIp } from "@/lib/audit";
import { z } from "zod";

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 80);
}

const createSchema = z.object({
  slug: z.string().optional().default(""),
  locale: z.enum(["fr", "en", "ar"]).default("fr"),
  title: z.string().min(1, "Title is required"),
  excerpt: z.string().min(1, "Excerpt is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
  readTime: z.number().int().positive().default(5),
  author: z.string().default("Ibda3 Digital"),
  image: z.string().optional().default(""),
  published: z.boolean().default(false),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database not available" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale");
  const published = searchParams.get("published");

  const where: Record<string, unknown> = {};
  if (locale && locale !== "ALL") where.locale = locale;
  if (published === "true") where.published = true;
  if (published === "false") where.published = false;

  const posts = await prisma.blogPost.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(posts);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database not available" }, { status: 503 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msgs = Object.entries(flat.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`);
    return NextResponse.json({ error: msgs.join("; ") || "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;

  if (!data.slug || !data.slug.match(/^[a-z0-9-]+$/)) {
    data.slug = slugify(data.title);
  }

  if (!data.slug) {
    return NextResponse.json({ error: "Could not generate a valid slug" }, { status: 400 });
  }

  try {
    const post = await prisma.blogPost.create({
      data: {
        slug: data.slug,
        locale: data.locale,
        title: data.title,
        excerpt: data.excerpt,
        content: data.content,
        category: data.category,
        readTime: data.readTime,
        author: data.author,
        image: data.image || null,
        published: data.published,
      },
    });

    await logAudit({
      userId: session.userId,
      userName: session.fullName,
      action: "CREATE_BLOG_POST",
      entity: "blog_post",
      entityId: post.id,
      details: { slug: data.slug, locale: data.locale },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(post, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "A post with this slug and locale already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
