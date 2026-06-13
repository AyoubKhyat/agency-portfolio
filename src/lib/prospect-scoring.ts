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

// Contact-channel weights per spec — what makes a prospect contactable.
// Engagement boosts stack on top for established prospects.
const WEIGHTS = {
  whatsapp: 40,         // wa.me link reachable
  instagram: 30,
  email: 20,
  website: 15,
  phone: 10,
  initialContactSent: 8,
  reply: 25,            // per reply (capped)
  meetingDone: 20,      // per completed meeting (capped)
  proposalOut: 15,      // per proposal (capped)
};

function hasValue(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export function scoreProspect(input: ProspectScoreInput): ProspectScoreResult {
  let score = 0;

  // Contact channels (max 115 before cap)
  const hasPhone = hasValue(input.phone) || hasValue(input.whatsappLink);
  if (hasValue(input.whatsappLink) || hasPhone) score += WEIGHTS.whatsapp;
  if (hasValue(input.instagram)) score += WEIGHTS.instagram;
  if (hasValue(input.email)) score += WEIGHTS.email;
  if (input.hasWebsite || hasValue(input.website)) score += WEIGHTS.website;
  if (hasPhone) score += WEIGHTS.phone;

  // Engagement (bonus on top, also capped by Math.min)
  if (input.sentAt) score += WEIGHTS.initialContactSent;
  score += Math.min(input.outreachReplies, 2) * WEIGHTS.reply;
  score += Math.min(input.meetingsCompleted, 2) * WEIGHTS.meetingDone;
  score += Math.min(input.proposalCount, 2) * WEIGHTS.proposalOut;

  score = Math.min(100, Math.round(score));

  // Businesses with NO contact channel get pushed to the bottom regardless of engagement.
  const anyChannel = hasPhone || hasValue(input.instagram) || hasValue(input.email) || input.hasWebsite || hasValue(input.website);
  if (!anyChannel) score = Math.min(score, 15);

  let label: ProspectScoreResult["label"];
  if (score >= 55) label = "HIGH";
  else if (score >= 25) label = "MEDIUM";
  else label = "LOW";

  return { score, label };
}
