import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { isMobileMA, isFixedLineMA, isActionableHot } from "@/lib/prospect-quality";

/**
 * Coverage report — counts that matter for "can I contact this prospect today?"
 *
 * Marrakech-focused. The catalog has 8 Moroccan cities ranked by business
 * density and outreach potential, surfaced when actionable-HOT is below the
 * threshold so the team knows where to look next.
 */

const ACTIONABLE_HOT_THRESHOLD = 100;

// Static intel — Moroccan cities by business density / outreach potential.
// Population in thousands (2024 approx, all sources Wikipedia/HCP).
// densityScore = subjective business-per-capita signal (1-10):
//   - economic capital, tourism hub, port = high
//   - regional capital, smaller = lower
// outreachScore = estimated reachability of B2B prospects (1-10):
//   - tourism-heavy + tech-zone cities lean to mobile-first, WhatsApp-native
const CITY_INTEL: Array<{ key: string; label: string; population: number; densityScore: number; outreachScore: number; sectors: string[]; rationale: string }> = [
  { key: "CASABLANCA", label: "Casablanca", population: 3700, densityScore: 10, outreachScore: 9,
    sectors: ["Real estate", "Restaurants", "Clinics", "Lawyers", "Accountants", "IT companies"],
    rationale: "Economic capital. Highest business density in Morocco; every sector is over-served by supply but agencies still find clients." },
  { key: "RABAT", label: "Rabat", population: 900, densityScore: 7, outreachScore: 8,
    sectors: ["Lawyers", "Architects", "Schools", "Clinics", "Restaurants"],
    rationale: "Administrative + professional services concentration. Smaller volume than Casa but higher conversion on legal/medical." },
  { key: "TANGER", label: "Tanger", population: 1200, densityScore: 8, outreachScore: 9,
    sectors: ["Hotels", "Restaurants", "Car rental", "Real estate", "Travel agencies"],
    rationale: "Port + free-zone + tourism + Tanger Med industrial pole. Mobile-first culture, businesses respond well to WhatsApp." },
  { key: "AGADIR", label: "Agadir", population: 950, densityScore: 7, outreachScore: 9,
    sectors: ["Hotels", "Restaurants", "Riads", "Spas", "Travel agencies", "Beauty salons"],
    rationale: "Tourism-driven. Hospitality sectors over-represented; great targets for AI assistants and booking automation." },
  { key: "FES", label: "Fès", population: 1200, densityScore: 6, outreachScore: 7,
    sectors: ["Riads", "Hotels", "Restaurants", "Travel agencies"],
    rationale: "Cultural capital, strong hospitality. Smaller modern-business sector but riads/hotels are abundant." },
  { key: "MEKNES", label: "Meknès", population: 600, densityScore: 5, outreachScore: 7,
    sectors: ["Restaurants", "Real estate", "Schools"],
    rationale: "Regional center. Lower volume but less competition for outreach attention." },
  { key: "KENITRA", label: "Kénitra", population: 500, densityScore: 5, outreachScore: 7,
    sectors: ["Schools", "Real estate", "Car rental", "Construction"],
    rationale: "Industrial growth + Atlantic free-zone. Construction and B2B services have momentum." },
  { key: "OUJDA", label: "Oujda", population: 500, densityScore: 4, outreachScore: 6,
    sectors: ["Restaurants", "Schools", "Real estate"],
    rationale: "Eastern regional capital. Smallest pool but underserved by Casa-based agencies." },
];

const MARRAKECH_LIKE_NEIGHBORHOODS = new Set([
  "Gueliz", "Hivernage", "Medina", "Sidi Ghanem", "Targa", "Mhamid",
  "Hay Hassani", "Daoudiate", "Semlalia", "Majorelle", "Agdal",
  "Palmeraie", "Izdihar", "Azli", "Hay Charaf", "Amerchich",
  "Massira", "Ennakhil", "Bab Doukkala", "Marrakech",
].map((s) => s.toLowerCase()));

function isMarrakechProspect(neighborhood: string | null | undefined): boolean {
  if (!neighborhood) return true; // unknown defaults to Marrakech since that's what we've been working with
  const lower = neighborhood.toLowerCase();
  if (MARRAKECH_LIKE_NEIGHBORHOODS.has(lower)) return true;
  for (const n of MARRAKECH_LIKE_NEIGHBORHOODS) {
    if (lower.includes(n)) return true;
  }
  return false;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const all = await prisma.prospect.findMany({
    select: {
      id: true, neighborhood: true, phone: true, whatsappLink: true,
      instagram: true, website: true, email: true, qualityLabel: true,
    },
  });

  const marrakech = all.filter((p) => isMarrakechProspect(p.neighborhood));

  // Detailed Marrakech breakdown — by REAL actionability, not just stored label
  let actionableHot = 0;
  let mobileOnly = 0;
  let instagramOnly = 0;
  let mobileAndInstagram = 0;
  let fixedLineOnly = 0;
  let websiteOnly = 0;
  let noContact = 0;

  for (const p of marrakech) {
    const signals = { phone: p.phone, whatsapp: p.whatsappLink, instagram: p.instagram, website: p.website, email: p.email };
    const mobile = isMobileMA(p.phone) || isMobileMA(p.whatsappLink);
    const fixed = isFixedLineMA(p.phone) && !mobile;
    const ig = !!(p.instagram && p.instagram.trim());
    const site = !!(p.website && p.website.trim());

    if (isActionableHot(signals)) {
      actionableHot++;
      if (mobile && ig) mobileAndInstagram++;
      else if (mobile) mobileOnly++;
      else if (ig) instagramOnly++;
    } else if (fixed) {
      fixedLineOnly++;
    } else if (site) {
      websiteOnly++;
    } else {
      noContact++;
    }
  }

  const needsExpansion = actionableHot < ACTIONABLE_HOT_THRESHOLD;

  // City recommendations — always returned, but the UI surfaces them prominently
  // only when needsExpansion is true.
  const recommendations = CITY_INTEL.map((c) => ({
    ...c,
    expectedScore: Math.round(c.population / 100 + c.densityScore * 8 + c.outreachScore * 5),
  })).sort((a, b) => b.expectedScore - a.expectedScore);

  return NextResponse.json({
    threshold: ACTIONABLE_HOT_THRESHOLD,
    needsExpansion,
    marrakech: {
      totalProspects: marrakech.length,
      actionableHot,
      breakdown: {
        mobileAndInstagram,
        mobileOnly,
        instagramOnly,
        fixedLineOnly,
        websiteOnly,
        noContact,
      },
      qualityLabels: {
        HOT: marrakech.filter((p) => p.qualityLabel === "HOT").length,
        WARM: marrakech.filter((p) => p.qualityLabel === "WARM").length,
        COLD: marrakech.filter((p) => p.qualityLabel === "COLD").length,
      },
    },
    recommendations,
    summary: needsExpansion
      ? `Marrakech has ${actionableHot} actionable-HOT prospects (target ${ACTIONABLE_HOT_THRESHOLD}). Consider expanding to ${recommendations[0].label} next.`
      : `Marrakech is covered with ${actionableHot} actionable-HOT prospects. Focus on conversion before expanding.`,
  });
}
