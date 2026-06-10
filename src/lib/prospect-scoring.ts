/**
 * Prospect scoring — converts signals into a 0..100 priority score and a label.
 * Designed for "who should I talk to next" — biased toward signal of intent + reach-ability.
 */

export type ProspectScoreInput = {
  hasWebsite: boolean;
  instagram: string | null | undefined;
  whatsappLink: string | null | undefined;
  sentAt: Date | string | null | undefined;
  outreachReplies: number;     // count of OutreachMessage where replied=true
  meetingsCompleted: number;   // count of Meeting where status = COMPLETED
  proposalCount: number;       // proposals tied to prospect
};

export type ProspectScoreResult = {
  score: number;
  label: "HIGH" | "MEDIUM" | "LOW";
};

const WEIGHTS = {
  hasWebsite: 12,
  hasInstagram: 10,
  hasWhatsapp: 10,
  initialContactSent: 8,
  reply: 25,        // per reply (capped)
  meetingDone: 20,  // per completed meeting (capped)
  proposalOut: 15,  // per proposal (capped)
};

export function scoreProspect(input: ProspectScoreInput): ProspectScoreResult {
  let score = 0;
  if (input.hasWebsite) score += WEIGHTS.hasWebsite;
  if (input.instagram && input.instagram.trim()) score += WEIGHTS.hasInstagram;
  if (input.whatsappLink && input.whatsappLink.trim()) score += WEIGHTS.hasWhatsapp;
  if (input.sentAt) score += WEIGHTS.initialContactSent;

  score += Math.min(input.outreachReplies, 2) * WEIGHTS.reply;
  score += Math.min(input.meetingsCompleted, 2) * WEIGHTS.meetingDone;
  score += Math.min(input.proposalCount, 2) * WEIGHTS.proposalOut;

  score = Math.min(100, Math.round(score));

  let label: ProspectScoreResult["label"];
  if (score >= 55) label = "HIGH";
  else if (score >= 25) label = "MEDIUM";
  else label = "LOW";

  return { score, label };
}
