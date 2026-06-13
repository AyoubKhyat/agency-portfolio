/**
 * Prospect scoring — converts signals into a 0..100 priority score and a label.
 * Designed for "who should I talk to next" — biased toward signal of intent + reach-ability.
 */

export type ProspectScoreInput = {
  hasWebsite: boolean;
  instagram: string | null | undefined;
  whatsappLink: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  website?: string | null | undefined;
  sentAt: Date | string | null | undefined;
  outreachReplies: number;     // count of OutreachMessage where replied=true
  meetingsCompleted: number;   // count of Meeting where status = COMPLETED
  proposalCount: number;       // proposals tied to prospect
};

export type ProspectScoreResult = {
  score: number;
  label: "HIGH" | "MEDIUM" | "LOW";
};

// Contact-channel weights — mobile-aware. Moroccan fixed lines (05xx) don't get
// the WhatsApp bonus because business landlines aren't reachable on WhatsApp.
const WEIGHTS = {
  whatsapp: 40,         // mobile phone OR verified wa.me link
  instagram: 30,
  email: 20,
  website: 15,
  fixedPhone: 10,       // landline-only fallback
  initialContactSent: 8,
  reply: 25,
  meetingDone: 20,
  proposalOut: 15,
};

function hasValue(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function isMobile(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const d = phone.replace(/\D/g, "").replace(/^212/, "").replace(/^0+/, "");
  return /^[67]/.test(d);
}

function isFixed(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const d = phone.replace(/\D/g, "").replace(/^212/, "").replace(/^0+/, "");
  return /^5/.test(d);
}

export function scoreProspect(input: ProspectScoreInput): ProspectScoreResult {
  let score = 0;

  // Contact channels
  const hasMobile = isMobile(input.phone) || isMobile(input.whatsappLink);
  const hasFixed = isFixed(input.phone) && !hasMobile;

  if (hasMobile) score += WEIGHTS.whatsapp;                 // mobile = WhatsApp reachable
  if (hasValue(input.instagram)) score += WEIGHTS.instagram;
  if (hasValue(input.email)) score += WEIGHTS.email;
  if (input.hasWebsite || hasValue(input.website)) score += WEIGHTS.website;
  if (hasFixed) score += WEIGHTS.fixedPhone;                // fixed line = small bonus, no WA

  // Engagement boosts
  if (input.sentAt) score += WEIGHTS.initialContactSent;
  score += Math.min(input.outreachReplies, 2) * WEIGHTS.reply;
  score += Math.min(input.meetingsCompleted, 2) * WEIGHTS.meetingDone;
  score += Math.min(input.proposalCount, 2) * WEIGHTS.proposalOut;

  score = Math.min(100, Math.round(score));

  // Cap businesses with no contact channel at 15 regardless of engagement
  const anyChannel = hasMobile || hasFixed || hasValue(input.instagram) || hasValue(input.email) || input.hasWebsite || hasValue(input.website);
  if (!anyChannel) score = Math.min(score, 15);

  let label: ProspectScoreResult["label"];
  if (score >= 55) label = "HIGH";
  else if (score >= 25) label = "MEDIUM";
  else label = "LOW";

  return { score, label };
}
