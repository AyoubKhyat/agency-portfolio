/**
 * Business report — money figures. Pure and DB-free so every rule is tested.
 *
 * Rules (Task 8, Phase 2B):
 * - MAD only. An amount in another (or no) currency, or one that is not a
 *   valid number, is never added or converted. It is counted per source in
 *   `excluded` so the page can say how many were left out.
 * - No fallbacks: signed contract value is never replaced by accepted
 *   proposals when it is zero.
 * - Each deal is counted in one bucket at most:
 *     signed            contract SIGNED / ACTIVE / COMPLETED
 *     awaiting signature contract PENDING_SIGNATURE whose proposal has no signed contract
 *     accepted, unsigned proposal ACCEPTED with no linked signed or pending contract
 *     sent              proposal SENT (the pipeline)
 *     draft             proposal DRAFT (shown apart, never pipeline)
 *   DRAFT and CANCELLED contracts are not counted; an accepted proposal's
 *   draft contract is represented by the proposal itself.
 * - Paid invoices are reported on their own, VAT included (`total`), never
 *   added to contract or proposal values (those are entered before tax).
 *   Period figures use `paidAt`; a PAID invoice without one is in the
 *   all-time total only and counted in `paidWithoutDate`.
 * - Signed contracts are dated by `signedDate` (both signing paths set it).
 *   One without it is in the all-time total only and counted in `signedWithoutDate`.
 */

export const REPORT_CURRENCY = "MAD";

export const SIGNED_CONTRACT_STATUSES: readonly string[] = ["SIGNED", "ACTIVE", "COMPLETED"];
export const AWAITING_SIGNATURE_STATUS = "PENDING_SIGNATURE";

export type BRProposal = { id: string; status: string; amount: number | null; currency: string | null };
export type BRContract = {
  id: string;
  status: string;
  amount: number | null;
  currency: string | null;
  proposalId: string | null;
  signedDate: Date | string | null;
  createdById: string | null;
  sector: string | null;
};
export type BRInvoice = { status: string; total: number | null; currency: string | null; paidAt: Date | string | null };

export type Bucket = { value: number; count: number };
export type Period = { thisMonth: Bucket; lastMonth: Bucket };

export type BusinessMoney = {
  signed: Bucket & Period & { signedWithoutDate: number };
  pipeline: {
    /** SENT proposals: the pipeline headline. */
    sent: Bucket;
    /** DRAFT proposals: not sent, never part of the pipeline. */
    drafts: Bucket;
    /** PENDING_SIGNATURE contracts not already represented by a signed contract. */
    awaitingSignature: Bucket;
    /** ACCEPTED proposals with no linked signed or pending contract. */
    acceptedUnsigned: Bucket;
  };
  paidInvoices: Bucket & Period & { paidWithoutDate: number };
  /** Left out of MAD figures (other or missing currency, or no valid amount), per source. */
  excluded: { proposals: number; contracts: number; invoices: number };
  /**
   * Proposals linked to more than one signed or pending contract. Every such
   * contract is still counted (nothing is guessed away); the number is shown
   * so the duplicates can be checked by hand.
   */
  proposalsWithSeveralContracts: number;
  topSalesperson: { userId: string; revenue: number; deals: number } | null;
  sectors: { sector: string; revenue: number; deals: number }[];
};

export function isMad(currency: string | null | undefined): boolean {
  return (currency ?? "").trim().toUpperCase() === REPORT_CURRENCY;
}

/** The amount if it is a finite number in MAD, else null. */
export function madAmount(amount: number | null | undefined, currency: string | null | undefined): number | null {
  if (!isMad(currency)) return null;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
}

/** Start of this month and of last month, in the server's local time (as before). */
export function monthWindows(now: Date): { thisMonthStart: Date; lastMonthStart: Date } {
  return {
    thisMonthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    lastMonthStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
  };
}

const bucket = (): Bucket => ({ value: 0, count: 0 });
const add = (b: Bucket, v: number) => { b.value += v; b.count += 1; };

function toDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t;
}

function addToPeriod(p: Period, date: Date | null, value: number, w: ReturnType<typeof monthWindows>): void {
  if (!date) return;
  if (date >= w.thisMonthStart) add(p.thisMonth, value);
  else if (date >= w.lastMonthStart) add(p.lastMonth, value);
}

export function buildBusinessMoney(
  input: { proposals: readonly BRProposal[]; contracts: readonly BRContract[]; invoices: readonly BRInvoice[] },
  now: Date = new Date(),
): BusinessMoney {
  const w = monthWindows(now);
  const excluded = { proposals: 0, contracts: 0, invoices: 0 };

  // ── Contracts ──
  const signed = { ...bucket(), thisMonth: bucket(), lastMonth: bucket(), signedWithoutDate: 0 };
  const awaitingSignature = bucket();
  const signedPerProposal = new Map<string, number>();
  const pendingProposalIds = new Set<string>();
  const openPerProposal = new Map<string, number>();
  const people = new Map<string, { revenue: number; deals: number }>();
  const sectors = new Map<string, { revenue: number; deals: number }>();

  // Which proposals already have a signed or pending contract (any currency): those
  // deals are represented by the contract, not by the accepted proposal.
  for (const c of input.contracts) {
    if (!c.proposalId) continue;
    const isSigned = SIGNED_CONTRACT_STATUSES.includes(c.status);
    if (isSigned) signedPerProposal.set(c.proposalId, (signedPerProposal.get(c.proposalId) ?? 0) + 1);
    else if (c.status === AWAITING_SIGNATURE_STATUS) pendingProposalIds.add(c.proposalId);
    if (isSigned || c.status === AWAITING_SIGNATURE_STATUS) openPerProposal.set(c.proposalId, (openPerProposal.get(c.proposalId) ?? 0) + 1);
  }

  for (const c of input.contracts) {
    const isSigned = SIGNED_CONTRACT_STATUSES.includes(c.status);
    const isPending = c.status === AWAITING_SIGNATURE_STATUS;
    if (!isSigned && !isPending) continue;
    if (isPending && c.proposalId && signedPerProposal.has(c.proposalId)) continue; // already signed
    const value = madAmount(c.amount, c.currency);
    if (value === null) { excluded.contracts += 1; continue; }

    if (isPending) { add(awaitingSignature, value); continue; }

    add(signed, value);
    const date = toDate(c.signedDate);
    if (date) addToPeriod(signed, date, value, w);
    else signed.signedWithoutDate += 1;

    if (c.createdById) {
      const p = people.get(c.createdById) ?? { revenue: 0, deals: 0 };
      p.revenue += value; p.deals += 1; people.set(c.createdById, p);
    }
    const sector = (c.sector ?? "").trim();
    if (sector) {
      const s = sectors.get(sector) ?? { revenue: 0, deals: 0 };
      s.revenue += value; s.deals += 1; sectors.set(sector, s);
    }
  }

  // ── Proposals ──
  const sent = bucket(), drafts = bucket(), acceptedUnsigned = bucket();
  for (const p of input.proposals) {
    const target =
      p.status === "SENT" ? sent
      : p.status === "DRAFT" ? drafts
      : p.status === "ACCEPTED" && !signedPerProposal.has(p.id) && !pendingProposalIds.has(p.id) ? acceptedUnsigned
      : null;
    if (!target) continue; // REJECTED, other statuses, or accepted and represented by a contract
    const value = madAmount(p.amount, p.currency);
    if (value === null) { excluded.proposals += 1; continue; }
    add(target, value);
  }

  // ── Paid invoices (VAT included) ──
  const paidInvoices = { ...bucket(), thisMonth: bucket(), lastMonth: bucket(), paidWithoutDate: 0 };
  for (const i of input.invoices) {
    if (i.status !== "PAID") continue;
    const value = madAmount(i.total, i.currency);
    if (value === null) { excluded.invoices += 1; continue; }
    add(paidInvoices, value);
    const date = toDate(i.paidAt);
    if (date) addToPeriod(paidInvoices, date, value, w);
    else paidInvoices.paidWithoutDate += 1;
  }

  const ranked = [...people.entries()].sort((a, b) => b[1].revenue - a[1].revenue || b[1].deals - a[1].deals || a[0].localeCompare(b[0]));
  const topSalesperson = ranked.length > 0 ? { userId: ranked[0][0], ...ranked[0][1] } : null;

  return {
    signed,
    pipeline: { sent, drafts, awaitingSignature, acceptedUnsigned },
    paidInvoices,
    excluded,
    proposalsWithSeveralContracts: [...openPerProposal.values()].filter((n) => n > 1).length,
    topSalesperson,
    sectors: [...sectors.entries()]
      .map(([sector, s]) => ({ sector, ...s }))
      .sort((a, b) => b.revenue - a.revenue || b.deals - a.deals || a.sector.localeCompare(b.sector))
      .slice(0, 5),
  };
}

/** "+12%" against last month, or null when last month had nothing to compare with. */
export function monthChange(thisMonth: number, lastMonth: number): string | null {
  if (!Number.isFinite(lastMonth) || lastMonth <= 0 || !Number.isFinite(thisMonth)) return null;
  const change = ((thisMonth - lastMonth) / lastMonth) * 100;
  return `${change >= 0 ? "+" : ""}${Math.round(change)}%`;
}
