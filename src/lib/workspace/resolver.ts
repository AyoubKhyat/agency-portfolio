/**
 * Lead Workspace resolver — read-only aggregation layer.
 *
 * Normalizes either a DiscoveryResult (pre-import) or a Prospect (Relationship)
 * into a single LeadWorkspace DTO. No writes, no schema changes: everything is
 * derived from fields that already exist. When a prospect originated from
 * discovery, its AI research is backfilled from the linked DiscoveryResult.
 */

import { prisma, hasPrisma } from "@/lib/prisma";
import {
  SEGMENT_LABELS,
  isProspectSegment,
  type ProspectSegment,
} from "@/lib/prospect-segments";
import { deriveProjectSize } from "@/lib/workspace/budget";
import type {
  LeadWorkspace,
  WorkspaceContactField,
  WorkspacePriority,
  WorkspaceStage,
} from "@/lib/workspace/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function ensureHttp(url: string): string {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function opportunityLabel(score: number): string {
  return score >= 70 ? "HOT" : score >= 45 ? "WARM" : "COLD";
}

function priorityFromScore(score: number): WorkspacePriority {
  return score >= 70 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";
}

function segmentOf(v: unknown): ProspectSegment {
  return isProspectSegment(v) ? v : "LEGACY_COLD";
}

/**
 * Derive the pipeline stage for an imported prospect from fields that already
 * exist on the row — no stored stage, no extra queries.
 */
function stageFromProspect(p: {
  status: string;
  sentAt: Date | null;
  contactedAt: Date | null;
  proposalDate: Date | null;
  proposalStatus: string | null;
}): WorkspaceStage {
  const s = (p.status || "").toUpperCase();
  if (s === "CLIENT" || s === "CONVERTI") return "CLIENT";
  if (p.proposalDate || p.proposalStatus || s.includes("PROPOSAL") || s === "NEGOTIATION") return "PROPOSAL";
  if (s === "MEETING" || s === "RDV" || s.includes("MEETING")) return "MEETING";
  if (s === "REPONDU" || s === "ENVOYE" || p.contactedAt || p.sentAt) return "CONTACTED";
  return "QUALIFIED";
}

function contact(
  label: string,
  value: string,
  valid: boolean,
  href: string | null,
): WorkspaceContactField {
  const has = Boolean(value) && valid;
  return { label, value: value || "", valid: has, href: has ? href : null };
}

/* ─────────────────────────── Discovery ─────────────────────────── */

export async function getDiscoveryWorkspace(id: string): Promise<LeadWorkspace | null> {
  if (!hasPrisma()) return null;
  const r = await prisma.discoveryResult.findUnique({ where: { id } });
  if (!r) return null;

  const segment = segmentOf(r.suggestedSegment);
  const service = r.suggestedOffer || "";
  const igUrl = r.instagramUrl || (r.instagram ? `https://instagram.com/${r.instagram.replace(/^@/, "")}` : "");

  const contacts: WorkspaceContactField[] = [
    contact("Website", r.website, r.websiteValid, ensureHttp(r.website)),
    contact("Instagram", r.instagram ? `@${r.instagram.replace(/^@/, "")}` : "", r.instagramValid, igUrl),
    contact("Email", r.email, r.emailValid, `mailto:${r.email}`),
    contact("Phone", r.phone, r.phoneValid, `tel:${r.phone.replace(/\s+/g, "")}`),
  ];

  const hasAi = Boolean(
    r.aiSummary || r.websiteSummary || r.suggestedOffer || r.opportunityExplanation,
  );

  return {
    source: "discovery",
    stage: r.importedProspectId ? "QUALIFIED" : "DISCOVERY",
    id: r.id,
    name: r.name,
    sector: r.sector || "Business",
    city: r.city || "",
    country: r.country || "",
    segment,
    segmentLabel: SEGMENT_LABELS[segment],
    scores: {
      opportunity: r.opportunityScore,
      confidence: r.confidenceScore,
      opportunityLabel: opportunityLabel(r.opportunityScore),
    },
    contacts,
    aiResearch: hasAi
      ? {
          aiSummary: r.aiSummary,
          websiteSummary: r.websiteSummary,
          suggestedOffer: r.suggestedOffer,
          opportunityExplanation: r.opportunityExplanation,
        }
      : null,
    opportunity: {
      whyInteresting: r.opportunityExplanation || r.aiSummary || "",
      recommendedService: service || "Website / online presence",
      priority: priorityFromScore(r.opportunityScore),
      budget: deriveProjectSize(segment, r.sector, service),
    },
    imported: r.importedProspectId
      ? {
          prospectId: r.importedProspectId,
          importedAt: iso(r.importedAt),
          importedByName: r.importedByName || null,
        }
      : null,
    origin: null,
    createdAt: r.createdAt.toISOString(),
  };
}

/* ─────────────────────────── Prospect ─────────────────────────── */

export async function getProspectWorkspace(id: string): Promise<LeadWorkspace | null> {
  if (!hasPrisma()) return null;
  const p = await prisma.prospect.findUnique({ where: { id } });
  if (!p) return null;

  // Backfill AI research from the originating discovery result, if any.
  const origin = await prisma.discoveryResult.findFirst({
    where: { importedProspectId: id },
    orderBy: { createdAt: "asc" },
  });

  const segment = segmentOf(p.segment);
  const igUrl = p.instagram ? `https://instagram.com/${p.instagram.replace(/^@/, "")}` : "";

  const contacts: WorkspaceContactField[] = [
    contact("Website", p.website, Boolean(p.website) && /\./.test(p.website), ensureHttp(p.website)),
    contact("Instagram", p.instagram ? `@${p.instagram.replace(/^@/, "")}` : "", Boolean(p.instagram), igUrl),
    contact("Email", p.email, EMAIL_RE.test(p.email || ""), `mailto:${p.email}`),
    contact("Phone", p.phone, Boolean(p.phone), `tel:${p.phone.replace(/\s+/g, "")}`),
  ];

  const service = origin?.suggestedOffer || (p.hasWebsite ? "Website revamp / SEO" : "Website / online presence");

  // Opportunity score: prefer the discovery signal; fall back to the prospect's own score.
  const oppScore = origin?.opportunityScore ?? p.score ?? 0;
  const priority: WorkspacePriority =
    origin?.opportunityScore != null
      ? priorityFromScore(origin.opportunityScore)
      : p.priority <= 1
        ? "HIGH"
        : p.priority === 2
          ? "MEDIUM"
          : "LOW";

  const hasAi = Boolean(
    origin &&
      (origin.aiSummary || origin.websiteSummary || origin.suggestedOffer || origin.opportunityExplanation),
  );

  return {
    source: "prospect",
    stage: stageFromProspect(p),
    id: p.id,
    name: p.name,
    sector: p.sector || "Business",
    city: p.neighborhood || "Marrakech",
    country: "Morocco",
    segment,
    segmentLabel: SEGMENT_LABELS[segment],
    scores: {
      opportunity: oppScore || null,
      confidence: origin?.confidenceScore ?? null,
      opportunityLabel: oppScore ? opportunityLabel(oppScore) : null,
    },
    contacts,
    aiResearch:
      hasAi && origin
        ? {
            aiSummary: origin.aiSummary,
            websiteSummary: origin.websiteSummary,
            suggestedOffer: origin.suggestedOffer,
            opportunityExplanation: origin.opportunityExplanation,
          }
        : null,
    opportunity: {
      whyInteresting:
        origin?.opportunityExplanation ||
        origin?.aiSummary ||
        `${p.name} is a ${p.sector || "business"} in the ${SEGMENT_LABELS[segment]} segment.`,
      recommendedService: service,
      priority,
      budget: deriveProjectSize(segment, p.sector, service),
    },
    imported: null,
    origin: origin
      ? { discoveryResultId: origin.id, discoveredAt: iso(origin.createdAt) }
      : null,
    createdAt: p.createdAt.toISOString(),
  };
}
