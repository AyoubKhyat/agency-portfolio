/**
 * Rule-based lead scoring for prospects.
 * Returns a 0-100 score, a label (Hot/Warm/Cold), and the factor breakdown.
 */

type ProspectInput = {
  hasWebsite: boolean;
  instagram: string;
  priority: number;
  sector: string;
  status: string;
  followUpDate: string | Date | null;
  proposalAmount: number | null;
  sentAt: string | Date | null;
  contactedAt: string | Date | null;
  neighborhood: string;
};

export type ScoreResult = {
  score: number;
  label: "Hot" | "Warm" | "Cold";
  factors: string[];
};

const HIGH_DEMAND_SECTORS = [
  "Restaurant/Café",
  "Riad/Maison d'hôtes",
  "Immobilier",
];

const MEDIUM_DEMAND_SECTORS = [
  "Salon Beauté",
  "Boutique Mode",
  "Bijouterie",
  "Spa/Hammam",
];

const PREMIUM_NEIGHBORHOODS = [
  "gueliz",
  "guéliz",
  "hivernage",
];

export function calculateLeadScore(prospect: ProspectInput): ScoreResult {
  let score = 0;
  const factors: string[] = [];

  // --- Website ---
  if (prospect.hasWebsite) {
    score -= 15;
    factors.push("Has website (-15)");
  } else {
    score += 20;
    factors.push("No website (+20)");
  }

  // --- Instagram ---
  if (prospect.instagram && prospect.instagram.trim() !== "") {
    score += 10;
    factors.push("Has Instagram (+10)");
  }

  // --- Priority level ---
  if (prospect.priority === 1) {
    score += 20;
    factors.push("High priority (+20)");
  } else if (prospect.priority === 2) {
    score += 10;
    factors.push("Medium priority (+10)");
  } else {
    factors.push("Low priority (+0)");
  }

  // --- Sector scoring ---
  const sectorNorm = prospect.sector.trim();
  if (HIGH_DEMAND_SECTORS.includes(sectorNorm)) {
    score += 15;
    factors.push(`High-demand sector: ${sectorNorm} (+15)`);
  } else if (MEDIUM_DEMAND_SECTORS.includes(sectorNorm)) {
    score += 10;
    factors.push(`Medium-demand sector: ${sectorNorm} (+10)`);
  } else {
    score += 5;
    factors.push(`Sector: ${sectorNorm} (+5)`);
  }

  // --- Status progression ---
  switch (prospect.status) {
    case "MEETING":
      score += 30;
      factors.push("Meeting scheduled (+30)");
      break;
    case "REPONDU":
      score += 25;
      factors.push("Replied (+25)");
      break;
    case "PROPOSAL_SENT":
      score += 20;
      factors.push("Proposal sent (+20)");
      break;
    case "ENVOYE":
      score += 5;
      factors.push("Message sent (+5)");
      break;
    default:
      // A_ENVOYER, PAS_DE_WHATSAPP, NEGOTIATION, CLIENT, CONVERTI, LOST etc.
      break;
  }

  // --- Follow-up date set ---
  if (prospect.followUpDate) {
    score += 10;
    factors.push("Follow-up date set (+10)");
  }

  // --- Has proposal amount ---
  if (prospect.proposalAmount && prospect.proposalAmount > 0) {
    score += 15;
    factors.push(`Proposal amount: ${prospect.proposalAmount} MAD (+15)`);
  }

  // --- Response speed: contactedAt within 24h of sentAt ---
  if (prospect.sentAt && prospect.contactedAt) {
    const sentTime = new Date(prospect.sentAt).getTime();
    const contactedTime = new Date(prospect.contactedAt).getTime();
    const diffHours = (contactedTime - sentTime) / (1000 * 60 * 60);
    if (diffHours >= 0 && diffHours <= 24) {
      score += 10;
      factors.push("Contacted within 24h of send (+10)");
    }
  }

  // --- Premium neighborhood ---
  const neighborhoodLower = (prospect.neighborhood || "").toLowerCase().trim();
  if (PREMIUM_NEIGHBORHOODS.some((n) => neighborhoodLower.includes(n))) {
    score += 10;
    factors.push(`Premium area: ${prospect.neighborhood} (+10)`);
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Label
  let label: "Hot" | "Warm" | "Cold";
  if (score >= 70) {
    label = "Hot";
  } else if (score >= 40) {
    label = "Warm";
  } else {
    label = "Cold";
  }

  return { score, label, factors };
}
