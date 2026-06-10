import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const CATEGORIES = ["WHATSAPP", "INSTAGRAM_DM", "CALL", "OBJECTION_HANDLING"] as const;
const LANGS = ["fr", "en", "ar"] as const;

const createSchema = z.object({
  category: z.enum(CATEGORIES),
  title: z.string().min(1),
  body: z.string().min(1),
  tags: z.string().default(""),
  language: z.enum(LANGS).default("fr"),
});

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json([]);

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (category && CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    where.category = category;
  }

  const scripts = await prisma.salesScript.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { category: "asc" }, { title: "asc" }],
  });
  return NextResponse.json(scripts);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const created = await prisma.salesScript.create({ data: parsed.data });
  return NextResponse.json(created, { status: 201 });
}
