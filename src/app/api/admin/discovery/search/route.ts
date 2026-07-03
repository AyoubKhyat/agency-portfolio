import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { runDiscovery, activeLeadSource } from "@/lib/discovery/pipeline";
import type { DiscoveryResultDTO } from "@/lib/discovery/types";

const schema = z.object({
  query: z.string().min(3).max(200),
  limit: z.number().int().min(3).max(12).optional(),
  debug: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { results: scored, debug } = await runDiscovery({ query: parsed.data.query, limit: parsed.data.limit });
  // Full trace only in Debug Mode, but ALWAYS surface a one-line reason so the
  // empty state can explain itself instead of "No businesses matched".
  const debugPayload = parsed.data.debug ? debug : undefined;
  const reason = debug.error ?? debug.unsupportedReason ?? null;

  if (!hasPrisma()) {
    // DB unavailable — surface results in-memory only. UI still renders.
    const dtos: DiscoveryResultDTO[] = scored.map((r, i) => ({
      ...r,
      id: `ephemeral-${i}`,
      sweepId: null,
      importedProspectId: null,
      createdAt: new Date().toISOString(),
    }));
    return NextResponse.json({ results: dtos, sweepId: null, debug: debugPayload, reason });
  }

  const sweep = await prisma.discoverySweep.create({
    data: {
      provider: activeLeadSource() === "OSM" ? "OSM" : "AI_MOCK",
      city: "",
      sector: "",
      neighborhood: null,
      keyword: parsed.data.query,
      query: parsed.data.query,
      resultCount: scored.length,
      uniqueCount: scored.filter((r) => r.duplicate.status !== "EXISTS").length,
      duplicateCount: scored.filter((r) => r.duplicate.status === "EXISTS").length,
      importedCount: 0,
      // Honest status: a swallowed provider error is a FAILED sweep, not an
      // empty COMPLETED one — so the reason is recorded, never hidden.
      status: debug.error ? "FAILED" : "COMPLETED",
      error: debug.error ?? debug.unsupportedReason ?? null,
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
          websiteSummary: r.websiteSummary,
          opportunityExplanation: r.opportunityExplanation,
          opportunityScore: r.opportunityScore,
          confidenceScore: r.confidenceScore,
          suggestedSegment: r.suggestedSegment,
          websiteValid: r.validity.website,
          emailValid: r.validity.email,
          phoneValid: r.validity.phone,
          instagramValid: r.validity.instagram,
          whatsappValid: r.validity.whatsapp,
          sourceValid: r.validity.sourceUrl,
          websiteStatus: r.verification.website.status,
          emailStatus: r.verification.email.status,
          phoneStatus: r.verification.phone.status,
          whatsappStatus: r.verification.whatsapp.status,
          instagramStatus: r.verification.instagram.status,
          whatsappUrl: r.whatsappUrl,
          instagramUrl: r.instagramUrl,
          emailSubject: r.emailSubject,
          emailBody: r.emailBody,
          whatsappBody: r.whatsappBody,
          aiProvider: r.aiProvider,
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

  return NextResponse.json({ results: dtos, sweepId: sweep.id, debug: debugPayload, reason });
}
