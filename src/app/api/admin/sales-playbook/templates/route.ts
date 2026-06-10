import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const CHANNELS = ["WHATSAPP", "INSTAGRAM", "EMAIL", "CALL"] as const;
const LANGS = ["fr", "en", "ar"] as const;

const createSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[A-Z0-9_]+$/),
  name: z.string().min(1),
  channel: z.enum(CHANNELS).default("WHATSAPP"),
  subject: z.string().default(""),
  body: z.string().min(1),
  language: z.enum(LANGS).default("fr"),
  notes: z.string().default(""),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json([]);

  const templates = await prisma.outreachTemplate.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const exists = await prisma.outreachTemplate.findUnique({ where: { key: parsed.data.key } });
  if (exists) return NextResponse.json({ error: "Key already exists" }, { status: 409 });

  const created = await prisma.outreachTemplate.create({ data: parsed.data });
  return NextResponse.json(created, { status: 201 });
}
