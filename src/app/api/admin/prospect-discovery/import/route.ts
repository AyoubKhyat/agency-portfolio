import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { scoreProspect } from "@/lib/prospect-scoring";
import { computeQualityLabel } from "@/lib/prospect-quality";
import { classify } from "@/lib/discovery-duplicates";
import { CITIES, SECTORS, type DiscoveryCandidate } from "@/lib/discovery-providers";

const candidateSchema = z.object({
  sourceId: z.string(),
  source: z.enum(["GOOGLE", "OSM"]),
  name: z.string().min(1),
  sector: z.string(),
  city: z.string(),
  neighborhood: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  facebook: z.string().nullable().optional(),
  mapsUrl: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  reviewCount: z.number().nullable().optional(),
});

const bodySchema = z.object({
  candidates: z.array(candidateSchema).min(1).max(500),
  ownerId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  allowPossibleDuplicates: z.boolean().default(true),
  tier: z.enum(["HOT_ONLY", "HOT_WARM", "ALL"]).default("ALL"),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  // Re-check duplicates server-side. NEVER trust the client to bypass dup-check.
  const existing = await prisma.prospect.findMany({
    select: { id: true, name: true, phone: true, instagram: true, whatsappLink: true, neighborhood: true, sector: true },
  });

  const created: { id: string; name: string }[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const cand of parsed.data.candidates) {
    // Resolve human-readable sector + city
    const sectorDef = SECTORS.find((s) => s.key === cand.sector);
    const cityDef = CITIES.find((c) => c.key === cand.city || c.label === cand.city);

    // Normalize: convert optional undefined to null to match DiscoveryCandidate shape
    const normalized: DiscoveryCandidate = {
      sourceId: cand.sourceId,
      source: cand.source,
      name: cand.name,
      sector: cand.sector,
      city: cand.city,
      neighborhood: cand.neighborhood ?? null,
      phone: cand.phone ?? null,
      whatsapp: cand.whatsapp ?? null,
      website: cand.website ?? null,
      instagram: cand.instagram ?? null,
      facebook: cand.facebook ?? null,
      mapsUrl: cand.mapsUrl ?? null,
      rating: cand.rating ?? null,
      reviewCount: cand.reviewCount ?? null,
    };
    const { status, reason } = classify(normalized, existing);
    if (status === "EXISTS") {
      skipped.push({ name: cand.name, reason: reason || "Already exists" });
      continue;
    }
    if (status === "POSSIBLE" && !parsed.data.allowPossibleDuplicates) {
      skipped.push({ name: cand.name, reason: reason || "Possible duplicate" });
      continue;
    }

    // Build prospect data
    const phone = cand.phone || "";
    const whatsappLink = cand.whatsapp || (phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : "");
    const website = cand.website || "";
    const email = cand.email || "";
    const instagram = cand.instagram || "";
    const sectorLabel = sectorDef?.label || cand.sector;
    const cityLabel = cityDef?.label || cand.city;

    // Quality label gate — skip imports below the chosen tier
    const qualityLabel = computeQualityLabel({ phone, whatsapp: whatsappLink, instagram, website, email });
    if (parsed.data.tier === "HOT_ONLY" && qualityLabel !== "HOT") {
      skipped.push({ name: cand.name, reason: `${qualityLabel} (tier=HOT_ONLY)` });
      continue;
    }
    if (parsed.data.tier === "HOT_WARM" && qualityLabel === "COLD") {
      skipped.push({ name: cand.name, reason: "COLD (tier=HOT_WARM)" });
      continue;
    }

    const score = scoreProspect({
      hasWebsite: !!website,
      instagram,
      whatsappLink,
      phone,
      email,
      website,
      sentAt: null,
      outreachReplies: 0,
      meetingsCompleted: 0,
      proposalCount: 0,
    });

    const prospect = await prisma.prospect.create({
      data: {
        name: cand.name,
        phone,
        whatsappLink,
        sector: sectorLabel,
        neighborhood: cand.neighborhood || cityLabel || "",
        instagram,
        hasWebsite: !!website,
        website,
        email,
        qualityLabel,
        status: "A_ENVOYER",
        priority: website ? 3 : (instagram ? 1 : 2),
        score: score.score,
        scoreLabel: score.label,
        scoredAt: new Date(),
        source: cand.source === "GOOGLE" ? "DISCOVERY_GOOGLE" : "DISCOVERY_OSM",
        campaignId: parsed.data.campaignId || null,
        ownerUserId: parsed.data.ownerId || null,
        lastActionAt: new Date(),
        lastActionByUserId: session.userId,
        lastActionByName: session.fullName,
      },
      select: { id: true, name: true },
    });

    created.push(prospect);

    // Add to existing so subsequent items in this batch don't also import
    existing.push({
      id: prospect.id,
      name: cand.name,
      phone,
      instagram: cand.instagram || "",
      whatsappLink,
      neighborhood: cand.neighborhood || "",
      sector: sectorLabel,
    });
  }

  // Backfill DiscoverySweep.importedCount for any sweeps in the last 24h
  // matching the (city, sector) of imports — best-effort, non-fatal.
  if (created.length > 0) {
    try {
      // Group imports by (cityKey, sectorKey)
      const byBucket = new Map<string, number>();
      for (const cand of parsed.data.candidates) {
        const cityKey = CITIES.find((c) => c.label === cand.city || c.key === cand.city)?.key;
        if (!cityKey) continue;
        // Only count those that actually got created
        const created_for_this_cand = created.find((c) => c.name === cand.name);
        if (!created_for_this_cand) continue;
        const bucket = `${cityKey}::${cand.sector}`;
        byBucket.set(bucket, (byBucket.get(bucket) || 0) + 1);
      }
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      for (const [bucket, count] of byBucket) {
        const [cityKey, sectorKey] = bucket.split("::");
        // Increment ALL recent sweeps for this bucket — small N (typically 1-3)
        await prisma.discoverySweep.updateMany({
          where: {
            city: cityKey,
            sector: sectorKey,
            startedAt: { gte: cutoff },
            status: "COMPLETED",
          },
          data: { importedCount: { increment: count } },
        });
      }
    } catch {
      // Don't fail the import because sweep bookkeeping failed
    }
  }

  return NextResponse.json({
    imported: created.length,
    skipped: skipped.length,
    created,
    skippedDetails: skipped,
  });
}
