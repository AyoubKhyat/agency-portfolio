import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().max(2000),
  events: z.string().min(1), // comma-separated
  secret: z.string().max(256).optional(),
  isActive: z.boolean().optional().default(true),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 500 });

  const webhooks = await prisma.webhook.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(webhooks);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 500 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const webhook = await prisma.webhook.create({
    data: {
      name: parsed.data.name,
      url: parsed.data.url,
      events: parsed.data.events,
      secret: parsed.data.secret || null,
      isActive: parsed.data.isActive,
    },
  });

  return NextResponse.json(webhook, { status: 201 });
}
