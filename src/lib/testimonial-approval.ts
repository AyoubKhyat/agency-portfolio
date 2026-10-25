/**
 * Client testimonials managed in Ibda3 OS (Projects → Edit → Client testimonial).
 *
 * One testimonial per project, shown as-is on the FR, EN and AR homepages (nothing is
 * translated): a quote, the author, the author's role, a private consent reference and one
 * publication status. Storage, no extra tables: the author and the consent reference are on
 * the project; the quote, role and approval are on the project's French translation row (the
 * canonical row: every project has one). The EN/AR testimonial columns are legacy: kept as
 * they are, never read or written.
 *
 * Rules (enforced by the API, tested here):
 *   - publishing needs an admin, a Client project, a consent reference, an author, a role and
 *     a quote within the limits, and the values the admin saw must still be the saved ones;
 *   - any change to the quote, the role or the author unpublishes it;
 *   - removing the consent reference unpublishes it.
 * Pure: no database or framework imports (shared by the API, the admin panel and tests).
 */
import { z } from "zod";

/** The translation row that holds the shared testimonial. */
export const CANONICAL_LOCALE = "fr";

export const TESTIMONIAL_LIMITS = { quote: 700, role: 120, author: 80, consent: 500 } as const;

/** What the admin API reads and writes. Empty strings stand for "not set". */
export type TestimonialState = {
  projectId: string;
  kind: string;
  author: string;
  consent: string;
  quote: string;
  role: string;
  approvedAt: Date | null;
  approvedBy: string | null;
  /** False only if the project has no French translation row (the testimonial needs one). */
  hasCanonicalRow: boolean;
};

const text = (max: number) => z.string().max(max * 4).transform((s) => s.trim()).pipe(z.string().max(max));

// Strict: a draft can never carry approval fields (approval has its own admin-only action).
export const draftSchema = z.object({
  author: text(TESTIMONIAL_LIMITS.author),
  consent: text(TESTIMONIAL_LIMITS.consent),
  quote: text(TESTIMONIAL_LIMITS.quote),
  role: text(TESTIMONIAL_LIMITS.role),
}).strict();
export type TestimonialDraft = z.infer<typeof draftSchema>;

export const approvalSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    /** Exactly what the admin saw and approves; must equal the saved values. */
    expected: z.object({ author: z.string(), role: z.string(), quote: z.string() }).strict(),
  }).strict(),
  z.object({ action: z.literal("revoke") }).strict(),
]);
export type ApprovalRequest = z.infer<typeof approvalSchema>;

export type RevokeReason = "quote_or_role_edited" | "author_edited" | "consent_removed";

export type SavePlan = {
  /** Project columns to write (undefined: unchanged). Empty strings are stored as null. */
  project: { author?: string; consent?: string };
  /** New quote and role for the canonical row (undefined: unchanged). */
  text?: { quote: string; role: string };
  /** Clear the publication (set whenever a change requires it, whatever the state when read). */
  unpublish: boolean;
  /** Why it is unpublished, when it was published before this save. */
  reason?: RevokeReason;
  changed: boolean;
};

/**
 * What saving `draft` over `state` must write. Only changed values are written, and any change
 * to the quote, role or author (or removing the consent reference) clears the publication.
 */
export function planTestimonialSave(state: TestimonialState, draft: TestimonialDraft): SavePlan {
  const plan: SavePlan = { project: {}, unpublish: false, changed: false };
  const textChanged = draft.quote !== state.quote || draft.role !== state.role;
  const authorChanged = draft.author !== state.author;
  const consentRemoved = state.consent.trim() !== "" && draft.consent === "";
  if (authorChanged) plan.project.author = draft.author;
  if (draft.consent !== state.consent) plan.project.consent = draft.consent;
  if (textChanged) plan.text = { quote: draft.quote, role: draft.role };
  plan.unpublish = textChanged || authorChanged || consentRemoved;
  if (plan.unpublish && state.approvedAt) {
    plan.reason = textChanged ? "quote_or_role_edited" : authorChanged ? "author_edited" : "consent_removed";
  }
  plan.changed = Object.keys(plan.project).length > 0 || !!plan.text;
  return plan;
}

/** Why the testimonial cannot be published right now, or null when it can. */
export function approvalProblem(state: TestimonialState, expected: { author: string; role: string; quote: string }): string | null {
  if (!state.hasCanonicalRow) return "Save the project in French first.";
  if (state.kind !== "CLIENT") return "Only Client projects can publish a testimonial.";
  if (!state.consent.trim()) return "Add the private consent reference first (where the client's written approval is kept).";
  if (!state.author.trim()) return "Add the author's name first.";
  if (!state.role.trim()) return "Add the author's role first.";
  if (!state.quote.trim()) return "Add the quote first.";
  if (state.quote.length > TESTIMONIAL_LIMITS.quote || state.role.length > TESTIMONIAL_LIMITS.role || state.author.length > TESTIMONIAL_LIMITS.author) {
    return "The quote, role or author is too long.";
  }
  if (expected.author !== state.author || expected.role !== state.role || expected.quote !== state.quote) {
    return "This testimonial changed since you loaded it. Reload and review it before publishing.";
  }
  return null;
}

export type TestimonialStatus = "empty" | "draft" | "published";
export function testimonialStatus(s: Pick<TestimonialState, "quote" | "role" | "approvedAt">): TestimonialStatus {
  if (!s.quote.trim() && !s.role.trim()) return "empty";
  return s.approvedAt ? "published" : "draft";
}

/** Short fingerprint of exactly what was approved, for the audit log (the text itself is not logged). */
export async function approvalFingerprint(v: { author: string; role: string; quote: string }): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify([v.author, v.role, v.quote]));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}
