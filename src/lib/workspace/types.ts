/**
 * Lead Workspace — the unified DTO that powers the company "operating desk".
 *
 * Both a DiscoveryResult (pre-import) and a Prospect (post-import / Relationship)
 * are normalized into this single shape by the resolver, so the workspace UI is
 * source-agnostic. Phase 2.2a is read-only; later phases (Outreach, Timeline,
 * Notes, Attachments, Proposal, Meetings, Contracts, Client Info) dock onto the
 * same DTO without redesigning the page.
 */

import type { ProspectSegment } from "@/lib/prospect-segments";
import type { VerificationStatus } from "@/lib/discovery/types";

export type WorkspaceSource = "discovery" | "prospect";

export type WorkspacePriority = "HIGH" | "MEDIUM" | "LOW";

/**
 * Where the company sits in the pipeline. Derived (never stored) from existing
 * entities — import state, prospect status, proposal fields, conversion.
 */
export type WorkspaceStage =
  | "DISCOVERY"
  | "QUALIFIED"
  | "CONTACTED"
  | "MEETING"
  | "PROPOSAL"
  | "CLIENT";

export type ProjectSize = "Small" | "Medium" | "Large" | "Enterprise";

/**
 * A single contact field. `href` is set ONLY when the field is VERIFIED —
 * otherwise the UI shows the value as non-clickable (Unverified) or hides it.
 */
export type WorkspaceContactField = {
  label: string;
  value: string;
  href: string | null;
  status: VerificationStatus;
};

export type WorkspaceScores = {
  opportunity: number | null;
  confidence: number | null;
  /** HOT | WARM | COLD, derived from the opportunity score. */
  opportunityLabel: string | null;
};

export type WorkspaceAiResearch = {
  aiSummary: string;
  websiteSummary: string;
  suggestedOffer: string;
  opportunityExplanation: string;
};

export type WorkspaceBudget = {
  /** Coarse project-size bucket — the trustworthy headline. */
  size: ProjectSize;
  /** Rough internal range, e.g. "≈ 8k–15k MAD". Never a fake-precise number. */
  rangeLabel: string;
  /** One-line explanation of how the estimate was derived. */
  basis: string;
};

export type WorkspaceOpportunity = {
  whyInteresting: string;
  recommendedService: string;
  priority: WorkspacePriority;
  budget: WorkspaceBudget;
};

/** Discovery → Relationships continuity (set only when a discovery result was imported). */
export type WorkspaceImportedLink = {
  prospectId: string;
  importedAt: string | null;
  importedByName: string | null;
};

/** Relationships ← Discovery origin (set only when a prospect came from discovery). */
export type WorkspaceOrigin = {
  discoveryResultId: string;
  discoveredAt: string | null;
};

export type LeadWorkspace = {
  source: WorkspaceSource;
  stage: WorkspaceStage;
  id: string;
  name: string;
  sector: string;
  city: string;
  country: string;
  segment: ProspectSegment;
  segmentLabel: string;
  scores: WorkspaceScores;
  contacts: WorkspaceContactField[];
  /** Null when a manual prospect has no AI research on record. */
  aiResearch: WorkspaceAiResearch | null;
  opportunity: WorkspaceOpportunity;
  imported: WorkspaceImportedLink | null;
  origin: WorkspaceOrigin | null;
  createdAt: string;
};
