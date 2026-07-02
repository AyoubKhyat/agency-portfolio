/**
 * Mock discovery provider — Phase 2.1.
 *
 * No real scraping, no Google API, no LLM. Given a natural-language query
 * like "Luxury hotels in Nice", it returns a plausible-looking set of
 * candidate businesses so the rest of the pipeline (audit → score → dedupe
 * → import) can be built and tested end-to-end.
 *
 * Real providers (Google Places, LLM-powered web crawl) will slot in behind
 * the same interface later.
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
  monaco: "Monaco",
  marrakech: "Morocco",
  casablanca: "Morocco",
  tangier: "Morocco",
  rabat: "Morocco",
  milan: "Italy",
  rome: "Italy",
  barcelona: "Spain",
  madrid: "Spain",
  london: "United Kingdom",
  dubai: "United Arab Emirates",
  geneva: "Switzerland",
  zurich: "Switzerland",
  brussels: "Belgium",
  amsterdam: "Netherlands",
};

/** Sector aliases → canonical label. */
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
    if (pattern.test(q)) {
      sector = label;
      break;
    }
  }

  let city = "";
  let country = "";
  const inMatch = q.match(/\bin\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-'\s]{1,40})$/i);
  if (inMatch) {
    city = inMatch[1].trim().replace(/\.$/, "");
  } else {
    for (const key of Object.keys(CITY_COUNTRY)) {
      if (lower.includes(key)) {
        city = key.charAt(0).toUpperCase() + key.slice(1);
        break;
      }
    }
  }
  const cityKey = city.toLowerCase();
  country = CITY_COUNTRY[cityKey] ?? "";
  if (city) city = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();

  let tier: ParsedQuery["tier"] = "standard";
  if (/luxury|palace|premium|high[- ]end|haute|5[- ]?star/i.test(q)) tier = "luxury";
  else if (/boutique|design|creative|premium/i.test(q)) tier = "premium";

  return { sector, city, country, tier };
}

/** Deterministic-ish pseudo-random from a string seed. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(seed: number, arr: readonly T[]): T {
  return arr[seed % arr.length];
}

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
  "Studio Nord", "Kaléido", "Atelier Pixel", "Maison Digitale",
  "Fabrique 21", "Studio Vertical", "Nouvelle Vague", "Studio Brut",
  "Collectif Neuf", "Atelier Signal", "Studio Cinq", "Prisme.co",
  "Studio Ombre", "Atelier Vif", "Studio Onze", "Maison Neuve",
  "Studio Cent", "Atelier Rouge", "Collectif Vertigo",
];
const ARCH_NAMES = [
  "Studio Volet", "Atelier Nord", "Maison Verticale", "Studio Métrique",
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
  "Studio Neuf", "Maison Blanche", "Cabinet Vert", "Atelier Zéro",
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

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function phoneForCountry(country: string, seed: number): string {
  switch (country) {
    case "France":            return `+33 4 ${String(90_000_00 + (seed % 9_999_99)).padStart(7, "0").replace(/(\d{2})(\d{2})(\d{3})/, "$1 $2 $3")}`;
    case "Monaco":            return `+377 9 ${String(70_00_00 + (seed % 9_99_99)).padStart(6, "0").replace(/(\d{2})(\d{2})(\d{2})/, "$1 $2 $3")}`;
    case "Morocco":           return `+212 6 ${String(20_00_00_00 + (seed % 9_99_99_99)).padStart(8, "0").replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4")}`;
    case "Italy":             return `+39 0${(seed % 9) + 1} ${String(1_000_000 + (seed % 9_999_999)).padStart(7, "0")}`;
    case "Spain":             return `+34 9${(seed % 9) + 1} ${String(100_00_00 + (seed % 9_99_99_99)).padStart(7, "0")}`;
    case "United Kingdom":    return `+44 20 ${String(7_000_0000 + (seed % 999_9999)).padStart(8, "0").replace(/(\d{4})(\d{4})/, "$1 $2")}`;
    case "United Arab Emirates": return `+971 4 ${String(300_0000 + (seed % 999_9999)).padStart(7, "0")}`;
    case "Switzerland":       return `+41 22 ${String(700_0000 + (seed % 999_9999)).padStart(7, "0")}`;
    default:                  return `+33 4 ${String(90_00_00_00 + (seed % 9_99_99_99)).padStart(8, "0").replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4")}`;
  }
}

function domainTld(country: string): string {
  switch (country) {
    case "France":            return "fr";
    case "Monaco":            return "mc";
    case "Morocco":           return "ma";
    case "Italy":             return "it";
    case "Spain":             return "es";
    case "United Kingdom":    return "co.uk";
    case "United Arab Emirates": return "ae";
    case "Switzerland":       return "ch";
    default:                  return "com";
  }
}

export async function mockDiscoverySearch({ query, limit = 8 }: DiscoverySearchInput): Promise<DiscoveryCandidate[]> {
  const q = parseQuery(query);
  const pool = namesForSector(q.sector);
  const size = Math.max(3, Math.min(limit, 12));
  const baseSeed = hash(query.trim().toLowerCase());

  const out: DiscoveryCandidate[] = [];
  const used = new Set<string>();
  for (let i = 0; out.length < size && i < size * 4; i++) {
    const seed = hash(`${query}|${i}`);
    let name = pick(seed + i, pool);
    // Vary a couple to avoid boring reuse in a small pool.
    if (used.has(name)) name = `${name} ${pick(seed, ["Studio", "Atelier", "House", "Group"])}`;
    if (used.has(name)) continue;
    used.add(name);

    const nameSlug = slug(name);
    const tld = domainTld(q.country);
    const hasWebsite = seed % 5 !== 0; // ~80% have a website
    const hasEmail = seed % 3 !== 0;
    const hasInstagram = seed % 4 !== 0;

    const domain = `${nameSlug}.${tld}`;
    const website = hasWebsite ? `https://${domain}` : "";
    const email = hasEmail ? `contact@${domain}` : "";
    const instagram = hasInstagram ? nameSlug.replace(/-/g, ".") : "";
    const phone = phoneForCountry(q.country, seed + baseSeed);

    out.push({
      name,
      website,
      phone,
      email,
      instagram,
      city: q.city || "",
      country: q.country || "",
      sector: q.sector,
      sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(name + " " + (q.city || ""))}`,
    });
  }

  return out;
}

export { parseQuery as __parseQueryForTests };
