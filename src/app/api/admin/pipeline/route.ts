import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json([]);

  const projects = await prisma.clientProject.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(projects);
}

const createSchema = z.object({
  name: z.string().min(1),
  clientName: z.string().min(1),
  description: z.string().optional().default(""),
  services: z.string().optional().default(""),
  status: z.string().optional().default("NEW"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().default("MEDIUM"),
  budget: z.number().optional().default(0),
  currency: z.string().optional().default("MAD"),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  ownerUserId: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  prospectId: z.string().nullable().optional(),
  proposalId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 500 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate);
  if (parsed.data.dueDate) data.dueDate = new Date(parsed.data.dueDate);

  const project = await prisma.clientProject.create({ data: data as never });

  return NextResponse.json(project, { status: 201 });
}
