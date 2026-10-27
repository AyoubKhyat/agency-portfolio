import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import { prisma, hasPrisma } from "@/lib/prisma";
import { toPublicWebhook } from "@/lib/webhooks";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().max(2000),
  events: z.string().min(1), // comma-separated
  secret: z.string().max(256).optional(),
  isActive: z.boolean().optional().default(true),
});

export async function GET() {
  const auth = await requireOwner();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 500 });

  const webhooks = await prisma.webhook.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(webhooks.map(toPublicWebhook));
}

export async function POST(req: Request) {
  const auth = await requireOwner();
  if (auth.response) return auth.response;
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

  return NextResponse.json(toPublicWebhook(webhook), { status: 201 });
}
