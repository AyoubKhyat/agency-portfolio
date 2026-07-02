import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { runDiscovery } from "@/lib/discovery/pipeline";
import type { DiscoveryResultDTO } from "@/lib/discovery/types";

const schema = z.object({
  query: z.string().min(3).max(200),
  limit: z.number().int().min(3).max(12).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const scored = await runDiscovery(parsed.data);

  if (!hasPrisma()) {
    // No DB — surface results in-memory only. The UI still renders.
    const dtos: DiscoveryResultDTO[] = scored.map((r, i) => ({
      ...r,
      id: `ephemeral-${i}`,
      sweepId: null,
      importedProspectId: null,
      createdAt: new Date().toISOString(),
    }));
    return NextResponse.json({ results: dtos, sweepId: null });
  }

  // Persist the sweep + results so the timeline can reference them later.
  const sweep = await prisma.discoverySweep.create({
    data: {
      provider: "AI_MOCK",
      city: "",
      sector: "",
      neighborhood: null,
      keyword: parsed.data.query,
      query: parsed.data.query,
      resultCount: scored.length,
      uniqueCount: scored.filter((r) => r.duplicate.status !== "EXISTS").length,
      duplicateCount: scored.filter((r) => r.duplicate.status === "EXISTS").length,
      importedCount: 0,
      status: "COMPLETED",
      completedAt: new Date(),
      startedById: session.userId,
      startedByName: session.fullName,
    },
    select: { id: true },
  });

  const created = await prisma.$transaction(
    scored.map((r) =>
      prisma.discoveryResult.create({
        data: {
          sweepId: sweep.id,
          name: r.name,
          website: r.website,
          phone: r.phone,
          email: r.email,
          instagram: r.instagram,
          city: r.city,
          country: r.country,
          sector: r.sector,
          sourceUrl: r.sourceUrl,
          aiSummary: r.aiSummary,
          suggestedOffer: r.suggestedOffer,
          opportunityScore: r.opportunityScore,
          confidenceScore: r.confidenceScore,
          suggestedSegment: r.suggestedSegment,
          duplicateStatus: r.duplicate.status,
          duplicateReason: r.duplicate.reason ?? null,
          duplicateProspectId: r.duplicate.prospectId ?? null,
        },
      })
    )
  );

  const dtos: DiscoveryResultDTO[] = created.map((row, i) => ({
    ...scored[i],
    id: row.id,
    sweepId: sweep.id,
    importedProspectId: null,
    createdAt: row.createdAt.toISOString(),
  }));

  return NextResponse.json({ results: dtos, sweepId: sweep.id });
}
