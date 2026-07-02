/**
 * Mock discovery provider — Phase 2.1.
 *
 * Deterministic-ish generation driven by the query text. For every business:
 *   name → slug → domain (country-appropriate TLD) → email → IG handle →
 *   phone (country dial code) → source URL.
 *
 * Consistency is the priority: a French luxury hotel gets a `.fr` domain, a
 * `+33` phone, an IG handle derived from the same slug, and a mailbox at the
 * same domain. No mismatched combinations.
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

const COUNTRY_TLD: Record<string, string> = {
  France: "fr",
  Monaco: "mc",
  Morocco: "ma",
  Italy: "it",
  Spain: "es",
  "United Kingdom": "co.uk",
  "United Arab Emirates": "ae",
  Switzerland: "ch",
  Belgium: "be",
  Netherlands: "nl",
};

const COUNTRY_DIAL: Record<string, string> = {
  France: "33",
  Monaco: "377",
  Morocco: "212",
  Italy: "39",
  Spain: "34",
  "United Kingdom": "44",
  "United Arab Emirates": "971",
  Switzerland: "41",
  Belgium: "32",
  Netherlands: "31",
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

/* ─────────────────────────── Consistency helpers ─────────────────────────── */

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Instagram handles can't have hyphens — use dots as separator. */
function handleFromSlug(s: string): string {
  return s.replace(/-/g, ".").replace(/^\.+|\.+$/g, "").replace(/\.+/g, ".").slice(0, 30);
}

function domainFromSlug(s: string, country: string): string {
  const tld = COUNTRY_TLD[country] ?? "com";
  const compact = s.replace(/-/g, "");
  return `${compact}.${tld}`;
}

function emailForDomain(domain: string): string {
  return `contact@${domain}`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Country-appropriate phone with subscriber digits derived from the same seed
 * — so the identity stays coherent (same "brand seed" → same phone).
 */
function phoneForCountry(country: string, seed: number): string {
  const dial = COUNTRY_DIAL[country] ?? "33";
  const subLen = subscriberLength(country);
  const rand = seededDigits(seed, subLen);
  // Guarantee first digit is not zero for E.164 correctness.
  const first = ((rand[0] as unknown as number) === 0 ? 1 : rand[0]);
  const rest = rand.slice(1);
  const subscriber = `${first}${rest}`;
  return `+${dial}${subscriber}`;
}

function subscriberLength(country: string): number {
  switch (country) {
    case "France": return 9;
    case "Monaco": return 8;
    case "Morocco": return 9;
    case "Italy": return 10;
    case "Spain": return 9;
    case "United Kingdom": return 10;
    case "United Arab Emirates": return 8;
    case "Switzerland": return 9;
    case "Belgium": return 9;
    case "Netherlands": return 9;
    default: return 9;
  }
}

function seededDigits(seed: number, count: number): string {
  const out: string[] = [];
  let s = seed >>> 0;
  for (let i = 0; i < count; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out.push(String(s % 10));
  }
  return out.join("");
}

/* ─────────────────────────── Provider ─────────────────────────── */

export async function mockDiscoverySearch({ query, limit = 8 }: DiscoverySearchInput): Promise<DiscoveryCandidate[]> {
  const q = parseQuery(query);
  const pool = namesForSector(q.sector);
  const size = Math.max(3, Math.min(limit, 12));
  const baseSeed = hash(query.trim().toLowerCase());

  const out: DiscoveryCandidate[] = [];
  const used = new Set<string>();

  for (let i = 0; out.length < size && i < size * 4; i++) {
    const pickSeed = hash(`${query}|pick|${i}`);
    let name = pool[pickSeed % pool.length];
    if (used.has(name)) {
      // Suffix to keep uniqueness without recycling the same 8 names.
      const suffixes = ["Studio", "House", "Group", "Collective", "Atelier"];
      name = `${name} ${suffixes[pickSeed % suffixes.length]}`;
    }
    if (used.has(name)) continue;
    used.add(name);

    // The identity seed drives all coherent properties of this business.
    const idSeed = hash(`${name}|${q.city}|${q.country}`);

    const nameSlug = slug(name);
    if (!nameSlug) continue;

    const handle = handleFromSlug(nameSlug);
    const domain = domainFromSlug(nameSlug, q.country);
    const email = emailForDomain(domain);
    const phone = phoneForCountry(q.country || "France", idSeed + baseSeed);

    // Every field is populated for the mock — realistic completeness.
    // Validation downstream still gates the UI; this is just the raw input.
    const website = `https://${domain}`;
    const instagram = handle;
    const sourceUrl = `https://www.google.com/search?q=${encodeURIComponent(`${name} ${q.city || ""}`.trim())}`;

    out.push({
      name,
      website,
      phone,
      email,
      instagram,
      city: q.city || "",
      country: q.country || "",
      sector: q.sector,
      sourceUrl,
    });
  }

  return out;
}
