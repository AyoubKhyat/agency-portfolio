import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { isMobileMA, isActionableHot } from "@/lib/prospect-quality";

/**
 * Marrakech Saturation Dashboard — proves Marrakech is (or isn't) exhausted.
 *
 * Unlock rule for expanding to other cities:
 *   saturation > 95%  OR  HOT-not-contacted < 50
 *
 * Until then, the expansion city cards stay locked and the team focuses
 * on the smart "Next Marrakech Prospects" queue.
 */

const SATURATION_THRESHOLD_PCT = 95;
const REMAINING_THRESHOLD = 50;
const NEXT_QUEUE_MIN_SCORE = 60;
const NEXT_QUEUE_LIMIT = 50;

const MARRAKECH_NEIGHBORHOODS = new Set([
  "Gueliz", "Hivernage", "Medina", "Sidi Ghanem", "Targa", "Mhamid",
  "Hay Hassani", "Daoudiate", "Route de Casablanca", "Route de Safi",
  "Route d'Ourika", "Route de Fès", "Semlalia", "Majorelle", "Agdal",
  "Palmeraie", "Izdihar", "Azli", "Hay Charaf", "Amerchich",
  "Massira", "Ennakhil", "Bab Doukkala", "Marrakech",
].map((s) => s.toLowerCase()));

function isMarrakech(neighborhood: string | null | undefined): boolean {
  if (!neighborhood) return true; // unknown defaults to Marrakech
  const lower = neighborhood.toLowerCase();
  if (MARRAKECH_NEIGHBORHOODS.has(lower)) return true;
  for (const n of MARRAKECH_NEIGHBORHOODS) {
    if (lower.includes(n)) return true;
  }
  return false;
}

// City catalog with concrete estimates. Discoverable estimate ≈ pop × density
// (subjective factor for how many business listings exist online per capita).
// HOT estimate ≈ discoverable × 0.65 (mobile-first culture in Morocco).
// Mobile estimate ≈ discoverable × 0.55 (most business contacts are mobile).
const EXPANSION_CITIES: Array<{
  key: string; label: string; populationK: number;
  discoverable: number; hot: number; mobile: number;
  sectors: string[]; rationale: string;
}> = [
  {
    key: "CASABLANCA", label: "Casablanca", populationK: 3700,
    discoverable: 15000, hot: 10000, mobile: 8500,
    sectors: ["Real estate", "Restaurants", "Clinics", "Lawyers", "Accountants", "IT companies", "Marketing"],
    rationale: "Economic capital. Every sector saturated with supply, agencies still find clients in the noise.",
  },
  {
    key: "TANGER", label: "Tanger", populationK: 1200,
    discoverable: 5000, hot: 3500, mobile: 3000,
    sectors: ["Hotels", "Restaurants", "Car rental", "Real estate", "Travel agencies", "Construction"],
    rationale: "Port + free-zone + tourism + Tanger Med industrial pole. Mobile-first, WhatsApp-native.",
  },
  {
    key: "RABAT", label: "Rabat", populationK: 900,
    discoverable: 4000, hot: 2700, mobile: 2300,
    sectors: ["Lawyers", "Architects", "Schools", "Clinics", "Restaurants", "Notaries"],
    rationale: "Administrative capital. Higher conversion on legal/medical due to budget concentration.",
  },
  {
    key: "AGADIR", label: "Agadir", populationK: 950,
    discoverable: 4500, hot: 3000, mobile: 2700,
    sectors: ["Hotels", "Restaurants", "Riads", "Spas", "Travel agencies", "Beauty salons"],
    rationale: "Tourism-driven. Hospitality sectors over-represented; great targets for booking automation.",
  },
];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  // Pull all prospects + the join data needed
  const all = await prisma.prospect.findMany({
    select: {
      id: true, name: true, sector: true, neighborhood: true,
      phone: true, whatsappLink: true, instagram: true, website: true, email: true,
      qualityLabel: true, score: true, status: true,
      sentAt: true, followup1At: true, followup2At: true, followup3At: true,
      lastActionAt: true, lastActionByName: true,
      owner: { select: { id: true, fullName: true, avatarInitials: true } },
      _count: {
        select: {
          outreachMessages: { where: { replied: true } },
          proposals: true,
          meetings: true,
        },
      },
    },
  });

  const marrakech = all.filter((p) => isMarrakech(p.neighborhood));
  const hot = marrakech.filter((p) => p.qualityLabel === "HOT");

  /* ---------- The 8 metrics ---------- */
  const totalProspects = marrakech.length;
  const hotTotal = hot.length;
  const hotContacted = hot.filter((p) => p.sentAt !== null).length;
  const hotNotContacted = hotTotal - hotContacted;
  const hotReplied = hot.filter((p) => p._count.outreachMessages > 0 || p.status === "REPONDU").length;
  const hotWithMeetings = hot.filter((p) => p._count.meetings > 0).length;
  const hotWithProposals = hot.filter((p) => p._count.proposals > 0).length;
  const hotConverted = hot.filter((p) => p.status === "CONVERTI" || p.status === "CLIENT").length;

  /* ---------- Saturation + unlock ---------- */
  const saturationPct = hotTotal > 0 ? Math.round((hotContacted / hotTotal) * 1000) / 10 : 0;
  let tier: "RED" | "ORANGE" | "YELLOW" | "GREEN" = "RED";
  if (saturationPct >= SATURATION_THRESHOLD_PCT) tier = "GREEN";
  else if (saturationPct >= 80) tier = "YELLOW";
  else if (saturationPct >= 50) tier = "ORANGE";

  const unlockedExpansion = saturationPct > SATURATION_THRESHOLD_PCT || hotNotContacted < REMAINING_THRESHOLD;

  let unlockReason: string;
  if (unlockedExpansion) {
    if (saturationPct > SATURATION_THRESHOLD_PCT) {
      unlockReason = `Saturation ${saturationPct}% — above the ${SATURATION_THRESHOLD_PCT}% gate`;
    } else {
      unlockReason = `Only ${hotNotContacted} HOT prospects left — below the ${REMAINING_THRESHOLD} gate`;
    }
  } else {
    unlockReason = `${hotNotContacted} HOT Marrakech prospects still uncontacted. Get to ${SATURATION_THRESHOLD_PCT}% or under ${REMAINING_THRESHOLD} remaining first.`;
  }

  /* ---------- Next prospects queue ---------- */
  // HOT + never contacted + (mobile OR Instagram) + score > 60
  const nextQueue = hot
    .filter((p) => !p.sentAt)
    .filter((p) => {
      const signals = { phone: p.phone, whatsapp: p.whatsappLink, instagram: p.instagram, website: p.website, email: p.email };
      return isActionableHot(signals);
    })
    .filter((p) => (p.score ?? 0) > NEXT_QUEUE_MIN_SCORE)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, NEXT_QUEUE_LIMIT)
    .map((p) => ({
      id: p.id, name: p.name, sector: p.sector, neighborhood: p.neighborhood,
      phone: p.phone, whatsappLink: p.whatsappLink, instagram: p.instagram,
      score: p.score, qualityLabel: p.qualityLabel,
      owner: p.owner,
      hasMobile: isMobileMA(p.phone),
      hasInstagram: !!(p.instagram && p.instagram.trim()),
    }));

  /* ---------- Expansion cities ---------- */
  const expansionCities = EXPANSION_CITIES.map((c) => ({
    ...c,
    locked: !unlockedExpansion,
  }));

  return NextResponse.json({
    config: {
      saturationThresholdPct: SATURATION_THRESHOLD_PCT,
      remainingThreshold: REMAINING_THRESHOLD,
      nextQueueMinScore: NEXT_QUEUE_MIN_SCORE,
      nextQueueLimit: NEXT_QUEUE_LIMIT,
    },
    metrics: {
      totalProspects,
      hotTotal,
      hotContacted,
      hotNotContacted,
      hotReplied,
      hotWithMeetings,
      hotWithProposals,
      hotConverted,
    },
    saturation: {
      percentage: saturationPct,
      tier,
      unlockedExpansion,
      unlockReason,
    },
    nextQueue,
    expansionCities,
  });
}
