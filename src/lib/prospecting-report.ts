/**
 * Prospecting report — pure, DB-free calculations behind /admin/analytics.
 *
 * Every number reuses the shared definitions in prospect-stages.ts, the same
 * ones the Today view uses:
 *
 * - CONTACTED is Today's definition (`isContacted`): a first-contact date, a
 *   status that implies contact (Waiting, Replied, In talks, Won), or any send
 *   record. It says the prospect is marked as contacted, not that a message
 *   arrived.
 * - SEND EVIDENCE is kept apart from that (`getSendEvidence`): a send recorded
 *   since the 2026-07-07 cleanup, only older (legacy) records, or none. A status
 *   of ENVOYE on its own is never a recorded send.
 * - REPLIED is the Replied, In talks and Won stages. WON is CLIENT / CONVERTI.
 *   CLOSED (LOST / PERDU / REFUSE) is counted on its own and never as a reply:
 *   the stored status cannot tell a refusal after a reply from no answer.
 *
 * Rates return null when their denominator is zero, so the page shows "—"
 * rather than a fake 0%.
 */
import { getStage, getSendEvidence, isContacted, CONTACTED_STATUSES, STAGES, type StageKey } from "./prospect-stages";

// ─── Prospects ──────────────────────────────────────────────────

export type ReportProspect = {
  sector: string | null;
  status: string;
  sentAt: Date | string | null;
  /** Latest send record (outreach message or send activity), any date. */
  lastSendAt: Date | string | null;
};

export type OutreachCounts = {
  prospects: number;
  /** Today's definition: date, contact status or any send record. */
  contacted: number;
  /** Contacted only because of the stored status: no first-contact date and no send record. */
  contactedByStatusOnly: number;
  /** Contacted, with a send recorded since the cleanup. */
  sendRecorded: number;
  /** Contacted, with send records that all predate the cleanup. */
  legacySendOnly: number;
  /** Contacted, with no send record at all. */
  noSendRecord: number;
  /** Stored as ENVOYE (Waiting for reply) with no send record of any date. */
  waitingWithoutSendRecord: number;
  /** Replied + In talks + Won. */
  replied: number;
  inTalks: number;
  won: number;
  /** LOST / PERDU / REFUSE. Not counted as replied. */
  closed: number;
  unreachable: number;
  toContact: number;
  /** Statuses that belong to no stage; shown, never guessed. */
  other: number;
};

export type OutreachRates = {
  /** contacted ÷ prospects */
  contactedRate: number | null;
  /** replied ÷ contacted */
  replyRate: number | null;
  /** won ÷ contacted */
  winRate: number | null;
  /** sendRecorded ÷ contacted */
  sendRecordedRate: number | null;
};

export type SectorRow = OutreachCounts & OutreachRates & { sector: string };

export type FunnelStep = { key: "PROSPECTS" | "CONTACTED" | "REPLIED" | "IN_TALKS_OR_WON" | "WON"; label: string; count: number };

export type ProspectingReport = {
  totals: OutreachCounts & OutreachRates;
  /** Current stage of every prospect (a snapshot, not history). */
  stages: { key: StageKey | "OTHER"; label: string; count: number }[];
  /** Each step is a subset of the one before, so drop-off is meaningful. */
  funnel: FunnelStep[];
  /** Outside the funnel: closed and unreachable prospects. */
  funnelAside: { closed: number; unreachable: number };
  sectors: SectorRow[];
};

export const NO_SECTOR = "(no sector)";

const REPLIED_STAGES: readonly StageKey[] = ["REPLIED", "IN_TALKS", "WON"];

/** Percentage rounded to one decimal, or null when there is nothing to divide by. */
export function rate(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

/** "12.5%" or "—" for a rate with no denominator. */
export function formatRate(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function emptyCounts(): OutreachCounts {
  return {
    prospects: 0, contacted: 0, contactedByStatusOnly: 0,
    sendRecorded: 0, legacySendOnly: 0, noSendRecord: 0, waitingWithoutSendRecord: 0,
    replied: 0, inTalks: 0, won: 0, closed: 0, unreachable: 0, toContact: 0, other: 0,
  };
}

function addProspect(c: OutreachCounts, p: ReportProspect): void {
  c.prospects += 1;
  const stage = getStage(p.status)?.key ?? null;

  if (isContacted(p)) {
    c.contacted += 1;
    if (!p.sentAt && !p.lastSendAt && CONTACTED_STATUSES.includes(p.status)) c.contactedByStatusOnly += 1;
    const evidence = getSendEvidence(p);
    if (evidence === "RECORDED") c.sendRecorded += 1;
    else if (evidence === "LEGACY") c.legacySendOnly += 1;
    else c.noSendRecord += 1;
  }
  if (stage === "WAITING" && !p.lastSendAt) c.waitingWithoutSendRecord += 1;

  if (stage && REPLIED_STAGES.includes(stage)) c.replied += 1;
  if (stage === "IN_TALKS") c.inTalks += 1;
  else if (stage === "WON") c.won += 1;
  else if (stage === "CLOSED") c.closed += 1;
  else if (stage === "UNREACHABLE") c.unreachable += 1;
  else if (stage === "TO_CONTACT") c.toContact += 1;
  else if (!stage) c.other += 1;
}

function withRates<T extends OutreachCounts>(c: T): T & OutreachRates {
  return {
    ...c,
    contactedRate: rate(c.contacted, c.prospects),
    replyRate: rate(c.replied, c.contacted),
    winRate: rate(c.won, c.contacted),
    sendRecordedRate: rate(c.sendRecorded, c.contacted),
  };
}

export function sectorName(sector: string | null | undefined): string {
  const s = (sector ?? "").trim();
  return s || NO_SECTOR;
}

export function buildProspectingReport(prospects: readonly ReportProspect[]): ProspectingReport {
  const totals = emptyCounts();
  const bySector = new Map<string, OutreachCounts>();
  const byStage = new Map<StageKey | "OTHER", number>();

  for (const p of prospects) {
    addProspect(totals, p);
    const name = sectorName(p.sector);
    let row = bySector.get(name);
    if (!row) { row = emptyCounts(); bySector.set(name, row); }
    addProspect(row, p);
    const key = getStage(p.status)?.key ?? "OTHER";
    byStage.set(key, (byStage.get(key) ?? 0) + 1);
  }

  const stages = [
    ...STAGES.map((s) => ({ key: s.key as StageKey | "OTHER", label: s.label, count: byStage.get(s.key) ?? 0 })),
    { key: "OTHER" as const, label: "Other status", count: byStage.get("OTHER") ?? 0 },
  ].filter((s) => s.count > 0);

  const funnel: FunnelStep[] = [
    { key: "PROSPECTS", label: "Prospects", count: totals.prospects },
    { key: "CONTACTED", label: "Contacted", count: totals.contacted },
    { key: "REPLIED", label: "Replied", count: totals.replied },
    { key: "IN_TALKS_OR_WON", label: "In talks or won", count: totals.inTalks + totals.won },
    { key: "WON", label: "Won", count: totals.won },
  ];

  const sectors = [...bySector.entries()]
    .map(([sector, c]) => ({ sector, ...withRates(c) }))
    .sort((a, b) => b.prospects - a.prospects || a.sector.localeCompare(b.sector));

  return {
    totals: withRates(totals),
    stages,
    funnel,
    funnelAside: { closed: totals.closed, unreachable: totals.unreachable },
    sectors,
  };
}

// ─── Proposals ──────────────────────────────────────────────────

export const REPORT_CURRENCY = "MAD";

export type ReportProposal = { status: string; amount: number | null; currency: string | null };

export type ProposalReport = {
  counts: { draft: number; sent: number; accepted: number; rejected: number; other: number; total: number };
  /** Proposals that left draft: sent, accepted or rejected. */
  issued: number;
  /** MAD only. Non-MAD proposals are counted in `excludedNonMad`, never converted. */
  mad: {
    draftValue: number;
    /** Sent and still awaiting an answer. */
    openValue: number;
    acceptedValue: number;
    /** Mean amount of issued MAD proposals, or null when there are none. */
    averageIssued: number | null;
    /** Issued MAD proposals the average is based on. */
    averageBasis: number;
  };
  /** Proposals left out of the MAD totals and average (other or missing currency, or no valid amount). */
  excludedNonMad: number;
  /** accepted ÷ (accepted + rejected) */
  acceptanceRate: number | null;
};

function isMad(currency: string | null | undefined): boolean {
  return (currency ?? "").trim().toUpperCase() === REPORT_CURRENCY;
}

export function buildProposalReport(proposals: readonly ReportProposal[]): ProposalReport {
  const counts = { draft: 0, sent: 0, accepted: 0, rejected: 0, other: 0, total: 0 };
  const mad = { draftValue: 0, openValue: 0, acceptedValue: 0, issuedSum: 0, issuedCount: 0 };
  let excludedNonMad = 0;

  for (const p of proposals) {
    counts.total += 1;
    const status = p.status;
    if (status === "DRAFT") counts.draft += 1;
    else if (status === "SENT") counts.sent += 1;
    else if (status === "ACCEPTED") counts.accepted += 1;
    else if (status === "REJECTED") counts.rejected += 1;
    else counts.other += 1;

    const amount = typeof p.amount === "number" && Number.isFinite(p.amount) ? p.amount : null;
    if (!isMad(p.currency) || amount === null) { excludedNonMad += 1; continue; }

    if (status === "DRAFT") mad.draftValue += amount;
    else if (status === "SENT") mad.openValue += amount;
    else if (status === "ACCEPTED") mad.acceptedValue += amount;
    if (status === "SENT" || status === "ACCEPTED" || status === "REJECTED") {
      mad.issuedSum += amount;
      mad.issuedCount += 1;
    }
  }

  return {
    counts,
    issued: counts.sent + counts.accepted + counts.rejected,
    mad: {
      draftValue: mad.draftValue,
      openValue: mad.openValue,
      acceptedValue: mad.acceptedValue,
      averageIssued: mad.issuedCount > 0 ? Math.round(mad.issuedSum / mad.issuedCount) : null,
      averageBasis: mad.issuedCount,
    },
    excludedNonMad,
    acceptanceRate: rate(counts.accepted, counts.accepted + counts.rejected),
  };
}
