/**
 * Mock discovery provider — honesty-first (Phase 2.2 verification redesign).
 *
 * A mock must NEVER fabricate contact information. It generates a realistic
 * business identity only:
 *   name → sector → city → country → source/search URL
 * Every contact field (website, email, phone, Instagram, WhatsApp) is left
 * EMPTY, so downstream validation marks it MISSING and the UI shows nothing
 * clickable. Real contacts only ever come from real, verified sources.
 *
 * AI summary, suggested offer and scores are added later in the pipeline
 * (audit + score stages), not here.
 */

import type { DiscoveryCandidate, DiscoverySearchInput } from "../types";

type ParsedQuery = {
  sector: string;
  city: string;
  country: string;
  tier: "luxury" | "premium" | "standard";
};

const CITY_COUNTRY: Record<string, string> = {
  nice: "France",
  paris: "France",
  lyon: "France",
  marseille: "France",
  cannes: "France",
  bordeaux: "France",
  monaco: "Monaco",
  marrakech: "Morocco",
  casablanca: "Morocco",
  tangier: "Morocco",
  rabat: "Morocco",
  milan: "Italy",
  rome: "Italy",
  florence: "Italy",
  barcelona: "Spain",
  madrid: "Spain",
  london: "United Kingdom",
  dubai: "United Arab Emirates",
  geneva: "Switzerland",
  zurich: "Switzerland",
  brussels: "Belgium",
  amsterdam: "Netherlands",
};

const SECTOR_ALIASES: Array<[RegExp, string]> = [
  [/luxury hotel|palace hotel|5[- ]?star/i, "Luxury Hotels"],
  [/hotel|riad|guest house|guesthouse|boutique hotel/i, "Hotels"],
  [/web agenc|digital agenc|creative agenc/i, "Web Agencies"],
  [/architec/i, "Architecture Studios"],
  [/interior design/i, "Interior Design Studios"],
  [/restaurant|bistro|brasserie/i, "Premium Restaurants"],
  [/jewel|jewellery|jewelry/i, "Jewelry Houses"],
  [/real estate|immobilier|property/i, "Real Estate"],
  [/wine|vineyard|château|chateau/i, "Wineries"],
  [/yacht/i, "Yacht Brokers"],
  [/law|avocat|attorney/i, "Law Firms"],
  [/spa|wellness|hammam/i, "Spa & Wellness"],
];

function parseQuery(raw: string): ParsedQuery {
  const q = raw.trim();
  const lower = q.toLowerCase();

  let sector = "Businesses";
  for (const [pattern, label] of SECTOR_ALIASES) {
    if (pattern.test(q)) { sector = label; break; }
  }

  let city = "";
  const inMatch = q.match(/\bin\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-'\s]{1,40})$/i);
  if (inMatch) {
    city = inMatch[1].trim().replace(/\.$/, "");
  } else {
    for (const key of Object.keys(CITY_COUNTRY)) {
      if (lower.includes(key)) { city = key.charAt(0).toUpperCase() + key.slice(1); break; }
    }
  }
  const country = CITY_COUNTRY[city.toLowerCase()] ?? "";
  if (city) city = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();

  let tier: ParsedQuery["tier"] = "standard";
  if (/luxury|palace|premium|high[- ]end|haute|5[- ]?star/i.test(q)) tier = "luxury";
  else if (/boutique|design|creative|premium/i.test(q)) tier = "premium";

  return { sector, city, country, tier };
}

/* ─────────────────────────── Name pools ─────────────────────────── */

const LUXURY_HOTEL_NAMES = [
  "Villa Belrose", "Le Grand Palais", "Château d'Azur", "Maison Bellevue",
  "Palais du Cap", "Résidence Royale", "La Réserve", "Villa Excellence",
  "Le Domaine Privé", "Riviera Palace", "Maison de Charme", "Le Belvédère",
  "Villa Serena", "Domaine Sainte-Rose", "Le Cap Royal", "Maison Sud",
  "Palais Sereno", "Villa d'Ombre", "Le Manoir Vertigo", "Résidence Blanche",
];
const HOTEL_NAMES = [
  "Hôtel Riviera", "Le Boutique 47", "Maison Rive", "Hôtel du Port",
  "Auberge Belleville", "Villa Marina", "Le Petit Palais", "Résidence Sud",
  "Hôtel Cent-Deux", "Maison Colline", "Le Neuf", "Villa Verte",
  "Hôtel Central", "Auberge du Marché", "Maison des Arts",
];
const WEB_AGENCY_NAMES = [
  "Studio Nord", "Kaleido", "Atelier Pixel", "Maison Digitale",
  "Fabrique 21", "Studio Vertical", "Nouvelle Vague", "Studio Brut",
  "Collectif Neuf", "Atelier Signal", "Studio Cinq", "Prisme",
  "Studio Ombre", "Atelier Vif", "Studio Onze", "Maison Neuve",
  "Studio Cent", "Atelier Rouge", "Collectif Vertigo",
];
const ARCH_NAMES = [
  "Studio Volet", "Atelier Nord", "Maison Verticale", "Studio Metrique",
  "Atelier Prisme", "Cabinet Bellini", "Studio Ligne", "Atelier Ombres",
  "Studio Verticale", "Atelier Terre", "Bureau Vertigo", "Studio Blanc",
  "Cabinet Duvivier", "Atelier Onde", "Studio Sud",
];
const RESTAURANT_NAMES = [
  "Le Botaniste", "Table Rouge", "Maison Cordon", "L'Épicurien",
  "Chez Marceau", "Le Comptoir Doré", "Table 12", "Bistro Nord",
  "L'Atelier des Chefs", "Maison Vert", "Le Vertigo", "Table d'Ombre",
  "L'Épicerie Fine", "Chez Paulette", "Le Café des Arts", "Bistro Sud",
];
const GENERIC_NAMES = [
  "Maison Aurel", "Studio Vent", "Atelier Sud", "Collectif Rive",
  "Studio Neuf", "Maison Blanche", "Cabinet Vert", "Atelier Zero",
  "Studio Trois", "Maison Onde", "Atelier Vertigo", "Cabinet Onze",
  "Studio Duvivier", "Atelier Neuf", "Maison Sereno",
];

function namesForSector(sector: string): readonly string[] {
  if (sector === "Luxury Hotels") return LUXURY_HOTEL_NAMES;
  if (sector === "Hotels") return HOTEL_NAMES;
  if (sector === "Web Agencies") return WEB_AGENCY_NAMES;
  if (sector === "Architecture Studios" || sector === "Interior Design Studios") return ARCH_NAMES;
  if (sector === "Premium Restaurants") return RESTAURANT_NAMES;
  return GENERIC_NAMES;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ─────────────────────────── Provider ─────────────────────────── */

export async function mockDiscoverySearch({ query, limit = 8 }: DiscoverySearchInput): Promise<DiscoveryCandidate[]> {
  const q = parseQuery(query);
  const pool = namesForSector(q.sector);
  const size = Math.max(3, Math.min(limit, 12));

  const out: DiscoveryCandidate[] = [];
  const used = new Set<string>();

  for (let i = 0; out.length < size && i < size * 4; i++) {
    const pickSeed = hash(`${query}|pick|${i}`);
    let name = pool[pickSeed % pool.length];
    if (used.has(name)) {
      const suffixes = ["Studio", "House", "Group", "Collective", "Atelier"];
      name = `${name} ${suffixes[pickSeed % suffixes.length]}`;
    }
    if (used.has(name)) continue;
    used.add(name);

    // The ONLY link a mock may emit is a neutral search URL — never a
    // fabricated website. Every contact field stays empty (→ MISSING).
    const sourceUrl = `https://www.google.com/search?q=${encodeURIComponent(`${name} ${q.city || ""}`.trim())}`;

    out.push({
      name,
      website: "",
      phone: "",
      email: "",
      instagram: "",
      city: q.city || "",
      country: q.country || "",
      sector: q.sector,
      sourceUrl,
    });
  }

  return out;
}
