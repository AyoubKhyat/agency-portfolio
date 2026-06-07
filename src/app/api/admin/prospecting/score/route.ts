import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { z } from "zod";

const bodySchema = z.union([
  z.object({ prospectId: z.string().min(1) }),
  z.object({ all: z.literal(true) }),
]);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide { prospectId } or { all: true }" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // --- Single prospect scoring ---
  if ("prospectId" in data) {
    const prospect = await prisma.prospect.findUnique({
      where: { id: data.prospectId },
    });
    if (!prospect) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    const result = calculateLeadScore({
      hasWebsite: prospect.hasWebsite,
      instagram: prospect.instagram,
      priority: prospect.priority,
      sector: prospect.sector,
      status: prospect.status,
      followUpDate: prospect.followUpDate,
      proposalAmount: prospect.proposalAmount,
      sentAt: prospect.sentAt,
      contactedAt: prospect.contactedAt,
      neighborhood: prospect.neighborhood,
    });

    const updated = await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        score: result.score,
        scoreLabel: result.label,
        scoredAt: new Date(),
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      score: result.score,
      label: result.label,
      factors: result.factors,
      scoredAt: updated.scoredAt,
    });
  }

  // --- Batch scoring (all: true) ---
  // Score all prospects that either have never been scored or were scored more than 1 hour ago
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const prospects = await prisma.prospect.findMany({
    where: {
      OR: [
        { scoredAt: null },
        { scoredAt: { lt: oneHourAgo } },
      ],
    },
  });

  const results: {
    id: string;
    name: string;
    score: number;
    label: string;
    factors: string[];
  }[] = [];

  for (const prospect of prospects) {
    const result = calculateLeadScore({
      hasWebsite: prospect.hasWebsite,
      instagram: prospect.instagram,
      priority: prospect.priority,
      sector: prospect.sector,
      status: prospect.status,
      followUpDate: prospect.followUpDate,
      proposalAmount: prospect.proposalAmount,
      sentAt: prospect.sentAt,
      contactedAt: prospect.contactedAt,
      neighborhood: prospect.neighborhood,
    });

    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        score: result.score,
        scoreLabel: result.label,
        scoredAt: new Date(),
      },
    });

    results.push({
      id: prospect.id,
      name: prospect.name,
      score: result.score,
      label: result.label,
      factors: result.factors,
    });
  }

  return NextResponse.json({
    scored: results.length,
    prospects: results,
  });
}
