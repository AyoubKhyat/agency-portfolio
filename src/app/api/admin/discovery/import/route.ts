import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { qualityLabelFromScore } from "@/lib/discovery/score";
import { isProspectSegment } from "@/lib/prospect-segments";

const schema = z.object({
  discoveryResultId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await prisma.discoveryResult.findUnique({
    where: { id: parsed.data.discoveryResultId },
  });
  if (!result) return NextResponse.json({ error: "Discovery result not found" }, { status: 404 });

  if (result.duplicateStatus === "EXISTS") {
    return NextResponse.json(
      { error: "Duplicate — already exists in Relationships", prospectId: result.duplicateProspectId },
      { status: 409 }
    );
  }

  if (result.importedProspectId) {
    return NextResponse.json(
      { error: "Already imported", prospectId: result.importedProspectId },
      { status: 409 }
    );
  }

  const digits = result.phone.replace(/\D/g, "");
  const whatsappLink = digits ? `https://wa.me/${digits}` : "";
  const qualityLabel = qualityLabelFromScore(result.opportunityScore);
  const segment = isProspectSegment(result.suggestedSegment) ? result.suggestedSegment : "LEGACY_COLD";

  const prospect = await prisma.prospect.create({
    data: {
      name: result.name,
      phone: result.phone,
      whatsappLink,
      sector: result.sector || "Other",
      neighborhood: result.city || "",
      instagram: result.instagram,
      hasWebsite: Boolean(result.website),
      website: result.website,
      email: result.email,
      qualityLabel,
      segment,
      priority: qualityLabel === "HOT" ? 1 : qualityLabel === "WARM" ? 2 : 3,
      status: "A_ENVOYER",
      source: "DISCOVERY_GOOGLE",
      ownerUserId: session.userId,
    },
  });

  const details = [
    `Discovered by AI Business Development Agent — "${result.name}"`,
    result.city && result.country ? `(${result.city}, ${result.country})` : "",
    `Opportunity ${result.opportunityScore} · Confidence ${result.confidenceScore}`,
  ]
    .filter(Boolean)
    .join(" ");

  await prisma.$transaction([
    prisma.prospectActivity.create({
      data: {
        prospectId: prospect.id,
        userId: session.userId,
        userName: session.fullName,
        actionType: "DISCOVERED",
        details,
      },
    }),
    prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        lastActionByUserId: session.userId,
        lastActionByName: session.fullName,
        lastActionAt: new Date(),
      },
    }),
    prisma.discoveryResult.update({
      where: { id: result.id },
      data: {
        importedProspectId: prospect.id,
        importedAt: new Date(),
        importedById: session.userId,
        importedByName: session.fullName,
      },
    }),
    ...(result.sweepId
      ? [
          prisma.discoverySweep.update({
            where: { id: result.sweepId },
            data: { importedCount: { increment: 1 } },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ prospectId: prospect.id, prospect }, { status: 201 });
}
