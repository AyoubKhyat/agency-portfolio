import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1),
  sector: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  prospectIds: z.array(z.string()).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json([]);

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { prospects: true } },
      owner: { select: { id: true, fullName: true } },
      template: { select: { id: true, name: true } },
    },
    take: 50,
  });

  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: parsed.data.name,
      sector: parsed.data.sector || null,
      city: parsed.data.city || null,
      ownerId: parsed.data.ownerId || null,
      templateId: parsed.data.templateId || null,
      createdById: session.userId,
      createdByName: session.fullName,
    },
  });

  // Attach prospects to this campaign (and assign owner if provided)
  if (parsed.data.prospectIds && parsed.data.prospectIds.length > 0) {
    await prisma.prospect.updateMany({
      where: { id: { in: parsed.data.prospectIds } },
      data: {
        campaignId: campaign.id,
        ...(parsed.data.ownerId ? { ownerUserId: parsed.data.ownerId } : {}),
      },
    });
  }

  return NextResponse.json(campaign, { status: 201 });
}
