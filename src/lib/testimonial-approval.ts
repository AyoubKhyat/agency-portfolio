/**
 * Client testimonials managed in Ibda3 OS (Projects → Edit → Testimonial).
 *
 * One testimonial per project: an author and a private consent reference on the
 * project, and per locale a quote and the author's role. Each locale is published
 * independently, only by an admin's explicit approval of the exact quote, role and
 * author, and only for a Client project. Rules (enforced by the API, tested here):
 *   - nothing is copied or translated between locales;
 *   - any change to a locale's quote or role revokes that locale's approval;
 *   - any change to the author, or removing the consent reference, revokes every locale;
 *   - approving needs a Client project, a consent reference, an author, a role and a
 *     quote within the limits, and the values the admin saw must still be the saved ones.
 * Pure: no database or framework imports (shared by the API, the admin panel and tests).
 */
import { z } from "zod";

export const TESTIMONIAL_LOCALES = ["fr", "en", "ar"] as const;
export type TestimonialLocale = (typeof TESTIMONIAL_LOCALES)[number];
export const isTestimonialLocale = (v: unknown): v is TestimonialLocale =>
  typeof v === "string" && (TESTIMONIAL_LOCALES as readonly string[]).includes(v);

export const TESTIMONIAL_LIMITS = { quote: 700, role: 120, author: 80, consent: 500 } as const;

export type TestimonialLocaleState = {
  quote: string;
  role: string;
  approvedAt: Date | null;
  approvedBy: string | null;
};

/** What the admin API reads and writes. Empty strings stand for "not set". */
export type TestimonialState = {
  projectId: string;
  kind: string;
  author: string;
  consent: string;
  /** Only locales that have a translation row (a testimonial needs the project saved in that language). */
  locales: Partial<Record<TestimonialLocale, TestimonialLocaleState>>;
};

const text = (max: number) => z.string().max(max * 4).transform((s) => s.trim()).pipe(z.string().max(max));

// Strict everywhere: a draft can never carry approval fields (approval has its own admin-only action).
const localeDraft = z.object({ quote: text(TESTIMONIAL_LIMITS.quote), role: text(TESTIMONIAL_LIMITS.role) }).strict().optional();
export const draftSchema = z.object({
  author: text(TESTIMONIAL_LIMITS.author),
  consent: text(TESTIMONIAL_LIMITS.consent),
  locales: z.object({ fr: localeDraft, en: localeDraft, ar: localeDraft }).strict(),
}).strict();
export type TestimonialDraft = z.infer<typeof draftSchema>;

export const approvalSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    locale: z.enum(TESTIMONIAL_LOCALES),
    /** Exactly what the admin saw and approves; must equal the saved values. */
    expected: z.object({ author: z.string(), role: z.string(), quote: z.string() }).strict(),
  }).strict(),
  z.object({ action: z.literal("revoke"), locale: z.enum(TESTIMONIAL_LOCALES) }).strict(),
]);
export type ApprovalRequest = z.infer<typeof approvalSchema>;

export type RevokeReason = "quote_or_role_edited" | "author_edited" | "consent_removed";

export type SavePlan = {
  /** Project columns to write (undefined: unchanged). Empty strings are stored as null. */
  project: { author?: string; consent?: string };
  /** Locales whose quote/role changed: write them and clear their approval. */
  locales: { locale: TestimonialLocale; quote: string; role: string }[];
  /** Locales whose approval this save removes (they were approved before), with why. */
  revoked: { locale: TestimonialLocale; reason: RevokeReason }[];
  /** Locales to clear approval on without changing their text (author/consent changes). */
  clearOnly: TestimonialLocale[];
  missingLocales: TestimonialLocale[];
  changed: boolean;
};

/**
 * What saving `draft` over `state` must write. Only changed fields are written, and every
 * change resets the affected approvals, whatever the approval state was when it was read.
 */
export function planTestimonialSave(state: TestimonialState, draft: TestimonialDraft): SavePlan {
  const plan: SavePlan = { project: {}, locales: [], revoked: [], clearOnly: [], missingLocales: [], changed: false };
  const authorChanged = draft.author !== state.author;
  const consentRemoved = state.consent.trim() !== "" && draft.consent === "";
  if (authorChanged) plan.project.author = draft.author;
  if (draft.consent !== state.consent) plan.project.consent = draft.consent;

  const touched = new Set<TestimonialLocale>();
  for (const locale of TESTIMONIAL_LOCALES) {
    const next = draft.locales[locale];
    if (!next) continue;
    const cur = state.locales[locale];
    if (!cur) {
      if (next.quote || next.role) plan.missingLocales.push(locale);
      continue;
    }
    if (next.quote !== cur.quote || next.role !== cur.role) {
      plan.locales.push({ locale, quote: next.quote, role: next.role });
      touched.add(locale);
      if (cur.approvedAt) plan.revoked.push({ locale, reason: "quote_or_role_edited" });
    }
  }
  if (authorChanged || consentRemoved) {
    const reason: RevokeReason = authorChanged ? "author_edited" : "consent_removed";
    for (const locale of TESTIMONIAL_LOCALES) {
      const cur = state.locales[locale];
      if (!cur || touched.has(locale)) continue;
      plan.clearOnly.push(locale);
      if (cur.approvedAt) plan.revoked.push({ locale, reason });
    }
  }
  plan.changed = Object.keys(plan.project).length > 0 || plan.locales.length > 0;
  return plan;
}

/** Why `locale` cannot be approved right now, or null when it can. */
export function approvalProblem(
  state: TestimonialState,
  locale: TestimonialLocale,
  expected: { author: string; role: string; quote: string },
): string | null {
  const cur = state.locales[locale];
  if (!cur) return "Save the project in this language first.";
  if (state.kind !== "CLIENT") return "Only Client projects can publish a testimonial.";
  if (!state.consent.trim()) return "Add the private consent reference first (where the client's written approval is kept).";
  if (!state.author.trim()) return "Add the author's name first.";
  if (!cur.role.trim()) return "Add the author's role for this language first.";
  if (!cur.quote.trim()) return "Add the quote for this language first.";
  if (cur.quote.length > TESTIMONIAL_LIMITS.quote || cur.role.length > TESTIMONIAL_LIMITS.role || state.author.length > TESTIMONIAL_LIMITS.author) {
    return "The quote, role or author is too long.";
  }
  if (expected.author !== state.author || expected.role !== cur.role || expected.quote !== cur.quote) {
    return "This testimonial changed since you loaded it. Reload and review it before approving.";
  }
  return null;
}

/**
 * For each locale, the other locales whose quote is the same text (ignoring case, surrounding and
 * repeated whitespace). Advisory only: the panel warns, nothing is blocked, translated or changed.
 */
export function duplicateQuoteLocales(
  quotes: Partial<Record<TestimonialLocale, string>>,
): Partial<Record<TestimonialLocale, TestimonialLocale[]>> {
  const norm = (s: string | undefined) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  const out: Partial<Record<TestimonialLocale, TestimonialLocale[]>> = {};
  for (const l of TESTIMONIAL_LOCALES) {
    const q = norm(quotes[l]);
    if (!q) continue;
    const same = TESTIMONIAL_LOCALES.filter((o) => o !== l && norm(quotes[o]) === q);
    if (same.length) out[l] = same;
  }
  return out;
}

export type TestimonialStatus = "empty" | "draft" | "published";
export function localeStatus(cur: TestimonialLocaleState | undefined): TestimonialStatus {
  if (!cur || (!cur.quote.trim() && !cur.role.trim())) return "empty";
  return cur.approvedAt ? "published" : "draft";
}

/** Short fingerprint of exactly what was approved, for the audit log (the text itself is not logged). */
export async function approvalFingerprint(v: { author: string; role: string; quote: string }): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify([v.author, v.role, v.quote]));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}
