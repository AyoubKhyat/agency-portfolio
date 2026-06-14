import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { isMobileMA } from "@/lib/prospect-quality";

/**
 * City comparison — REAL counts from the prospects table. No estimates,
 * no population data, no theoretical market sizes.
 *
 * City is inferred from the prospect's neighborhood field by matching
 * known neighborhood names per city.
 */

const CITY_MATCHERS: Array<{ key: string; label: string; matches: string[] }> = [
  { key: "MARRAKECH",  label: "Marrakech",  matches: ["Marrakech","Gueliz","Hivernage","Medina","Sidi Ghanem","Targa","Mhamid","Hay Hassani","Daoudiate","Route de Casablanca","Route de Safi","Route d'Ourika","Route de Fès","Semlalia","Majorelle","Agdal","Palmeraie","Izdihar","Azli","Hay Charaf","Amerchich","Massira","Ennakhil","Bab Doukkala"] },
  { key: "CASABLANCA", label: "Casablanca", matches: ["Casablanca","Casa","Maarif","Anfa","Gauthier","Sidi Belyout","Ain Diab","Bourgogne"] },
  { key: "RABAT",      label: "Rabat",      matches: ["Rabat","Hassan","Hay Riad","Yacoub El Mansour","Souissi"] },
  { key: "TANGER",     label: "Tanger",     matches: ["Tanger","Tangier"] },
  { key: "AGADIR",     label: "Agadir",     matches: ["Agadir","Founty","Talborjt","Sonaba","Hay Mohammadi","Centre Ville"] },
  { key: "FES",        label: "Fès",        matches: ["Fès","Fes"] },
  { key: "MEKNES",     label: "Meknès",     matches: ["Meknès","Meknes"] },
  { key: "KENITRA",    label: "Kénitra",    matches: ["Kénitra","Kenitra"] },
  { key: "OUJDA",      label: "Oujda",      matches: ["Oujda"] },
];

function classifyCity(neighborhood: string | null | undefined): string {
  if (!neighborhood) return "MARRAKECH"; // default for legacy data
  const lower = neighborhood.toLowerCase();
  for (const city of CITY_MATCHERS) {
    for (const m of city.matches) {
      if (lower.includes(m.toLowerCase())) return city.key;
    }
  }
  return "UNKNOWN";
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const all = await prisma.prospect.findMany({
    select: {
      neighborhood: true, phone: true, whatsappLink: true,
      instagram: true, qualityLabel: true, sentAt: true,
    },
  });

  // Initialize per-city accumulators including all known cities so the table
  // shows zero-count cities too (which is itself the answer the user wants).
  const stats: Record<string, {
    key: string; label: string;
    current: number; hot: number;
    mobile: number; instagram: number;
    uncontacted: number; actionable: number;
  }> = {};
  for (const c of CITY_MATCHERS) {
    stats[c.key] = { key: c.key, label: c.label, current: 0, hot: 0, mobile: 0, instagram: 0, uncontacted: 0, actionable: 0 };
  }
  stats["UNKNOWN"] = { key: "UNKNOWN", label: "Unknown / other", current: 0, hot: 0, mobile: 0, instagram: 0, uncontacted: 0, actionable: 0 };

  for (const p of all) {
    const cityKey = classifyCity(p.neighborhood);
    const s = stats[cityKey];
    s.current++;
    if (p.qualityLabel === "HOT") s.hot++;

    const mobile = isMobileMA(p.phone) || isMobileMA(p.whatsappLink);
    const ig = !!(p.instagram && p.instagram.trim());

    if (mobile) s.mobile++;
    if (ig) s.instagram++;
    if (!p.sentAt) s.uncontacted++;
    if ((mobile || ig) && !p.sentAt) s.actionable++;
  }

  const cities = Object.values(stats).sort((a, b) => b.actionable - a.actionable);

  return NextResponse.json({
    cities,
    totals: {
      cityCount: cities.filter((c) => c.current > 0).length,
      totalProspects: all.length,
    },
  });
}
