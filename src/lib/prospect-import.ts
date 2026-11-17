/**
 * Server-side prospect import shared by the import API (owner or admin) and the Daily Lead Agent's Today import
 * (any team member, one lead of today's list; see src/app/api/admin/daily-leads/route.ts). Moved unchanged from
 * the import route: input validation, the server-side duplicate re-check, the quality tier, the audit note written
 * with the prospect, attribution to the importing user, and the best-effort sweep bookkeeping.
 *
 * It does no authorization of its own: every caller must check the session first.
 */
import { z } from "zod";
import type { SessionUser } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { scoreProspect } from "@/lib/prospect-scoring";
import { computeQualityLabel } from "@/lib/prospect-quality";
import { classify } from "@/lib/discovery-duplicates";
import { CITIES, SECTORS, type DiscoveryCandidate } from "@/lib/discovery-providers";
import { repairInstagram } from "@/lib/discovery/validate";
import { explicitWhatsAppLink } from "@/lib/contact-check";
import { auditSchema, buildAuditNote } from "@/lib/audit-note";

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
  // Optional: the website check Find businesses ran. Kept as a dated note on the new prospect (see audit-note.ts).
  audit: auditSchema.optional(),
});

const bodySchema = z.object({
  candidates: z.array(candidateSchema).min(1).max(500),
  ownerId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  // Default OFF: a POSSIBLE match is a manual-review outcome, not a fresh
  // prospect. Callers must opt in explicitly after looking at the match.
  allowPossibleDuplicates: z.boolean().default(false),
  tier: z.enum(["HOT_ONLY", "HOT_WARM", "ALL"]).default("ALL"),
});

export type ImportSession = Pick<SessionUser, "userId" | "fullName">;
export type ImportBody = {
  imported: number;
  skipped: number;
  created: { id: string; name: string }[];
  skippedDetails: { name: string; reason: string }[];
};
export type ImportOutcome =
  | { status: 200; body: ImportBody }
  | { status: 400 | 503; body: { error: string; details?: unknown } };

/** Imports the candidates in `input` (the import API's JSON body) as `session`. Never throws for bad input. */
export async function importCandidates(input: unknown, session: ImportSession): Promise<ImportOutcome> {
  if (!hasPrisma()) return { status: 503, body: { error: "DB unavailable" } };

  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) {
    return { status: 400, body: { error: "Invalid input", details: parsed.error.issues } };
  }

  // Re-check duplicates server-side. NEVER trust the client to bypass dup-check.
  const existing = await prisma.prospect.findMany({
    select: { id: true, name: true, phone: true, instagram: true, whatsappLink: true, neighborhood: true, sector: true, website: true, email: true },
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
      email: cand.email ?? null,
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

    // Build prospect data.
    // WhatsApp is NEVER derived from the phone — only an explicit, real
    // whatsapp link from the source counts, and even that is UNVERIFIED until
    // manually confirmed. No source-provided link → empty (button hidden).
    const phone = cand.phone || "";
    // Only an explicit https wa.me / api.whatsapp.com link with a number; anything else is dropped.
    const whatsappLink = explicitWhatsAppLink(cand.whatsapp);
    const website = cand.website || "";
    const email = cand.email || "";
    // Normalize to a bare handle so a later "Confirm Instagram" yields a valid
    // link; format-invalid handles are dropped (empty → button hidden).
    const instagram = repairInstagram(cand.instagram || "").handle;
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

    // Written here from validated fields only; null for an incomplete check or nothing left to keep.
    const auditNote = cand.audit ? buildAuditNote(cand.audit, website) : null;

    // One write: the prospect and its audit note are saved together or not at all.
    const prospect = await prisma.prospect.create({
      data: {
        ...(auditNote ? { notes: { create: { content: auditNote, authorId: session.userId, authorName: session.fullName } } } : {}),
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
        // Nobody has opened these yet: a person checks them on the prospect page.
        whatsappStatus: "UNVERIFIED",
        instagramStatus: "UNVERIFIED",
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
      website,
      email,
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

  return {
    status: 200,
    body: {
      imported: created.length,
      skipped: skipped.length,
      created,
      skippedDetails: skipped,
    },
  };
}
