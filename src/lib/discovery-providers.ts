/**
 * Prospect discovery providers.
 *
 * Two implementations behind the same interface:
 *  - GooglePlacesProvider — used when GOOGLE_PLACES_API_KEY is set (richer data)
 *  - OsmProvider — used otherwise (free, public, sparser in Morocco)
 *
 * Both return the same normalized DiscoveryCandidate shape so the rest of
 * the system doesn't care which source produced the result.
 */

export type DiscoveryCandidate = {
  sourceId: string;
  source: "GOOGLE" | "OSM";
  name: string;
  sector: string;
  city: string;
  neighborhood: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  mapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
};

export type DiscoverySearchQuery = {
  city: string;
  sector: string; // sector key, e.g. CLINICS
  neighborhood: string | null;
  keyword: string | null;
};

export type DiscoveryProviderName = "GOOGLE" | "OSM";

/* ---------- Sector taxonomy ---------- */

export type SectorCategory =
  | "Healthcare"
  | "Legal & Finance"
  | "Real Estate & Construction"
  | "Hospitality & Travel"
  | "Food & Drink"
  | "Beauty & Wellness"
  | "Education"
  | "Professional Services"
  | "Retail"
  | "Events & Media";

export type SectorDef = {
  key: string;
  label: string;
  category: SectorCategory;
  googleQuery: string;
  osmTags: Array<{ key: string; value: string }>;
  osmNameFilter?: RegExp;
};

export const SECTORS: SectorDef[] = [
  // === Healthcare ===
  { key: "DENTISTS", label: "Dentists", category: "Healthcare", googleQuery: "dentist", osmTags: [{ key: "amenity", value: "dentist" }, { key: "healthcare", value: "dentist" }] },
  { key: "DOCTORS", label: "Doctors", category: "Healthcare", googleQuery: "doctor medical practice", osmTags: [{ key: "amenity", value: "doctors" }, { key: "healthcare", value: "doctor" }] },
  { key: "CLINICS", label: "Clinics", category: "Healthcare", googleQuery: "clinic", osmTags: [{ key: "amenity", value: "clinic" }, { key: "healthcare", value: "clinic" }] },
  { key: "PHYSIOTHERAPISTS", label: "Physiotherapists", category: "Healthcare", googleQuery: "physiotherapist", osmTags: [{ key: "healthcare", value: "physiotherapist" }] },
  { key: "OSTEOPATHS", label: "Osteopaths", category: "Healthcare", googleQuery: "osteopath", osmTags: [{ key: "healthcare", value: "osteopath" }] },
  { key: "PHARMACIES", label: "Pharmacies", category: "Healthcare", googleQuery: "pharmacy", osmTags: [{ key: "amenity", value: "pharmacy" }] },
  { key: "VETERINARY", label: "Veterinary clinics", category: "Healthcare", googleQuery: "veterinary clinic", osmTags: [{ key: "amenity", value: "veterinary" }] },

  // === Legal & Finance ===
  { key: "LAWYERS", label: "Lawyers", category: "Legal & Finance", googleQuery: "lawyer law firm", osmTags: [{ key: "office", value: "lawyer" }] },
  { key: "NOTARIES", label: "Notaries", category: "Legal & Finance", googleQuery: "notary public", osmTags: [{ key: "office", value: "notary" }] },
  { key: "ACCOUNTANTS", label: "Accountants", category: "Legal & Finance", googleQuery: "accountant accounting firm", osmTags: [{ key: "office", value: "accountant" }] },
  { key: "TAX_CONSULTANTS", label: "Tax consultants", category: "Legal & Finance", googleQuery: "tax consultant", osmTags: [{ key: "office", value: "tax_advisor" }] },
  { key: "INSURANCE", label: "Insurance brokers", category: "Legal & Finance", googleQuery: "insurance agency", osmTags: [{ key: "office", value: "insurance" }] },

  // === Real Estate & Construction ===
  { key: "REAL_ESTATE", label: "Real estate agencies", category: "Real Estate & Construction", googleQuery: "real estate agency", osmTags: [{ key: "office", value: "estate_agent" }] },
  { key: "PROPERTY_MGMT", label: "Property managers", category: "Real Estate & Construction", googleQuery: "property management", osmTags: [{ key: "office", value: "property_management" }] },
  { key: "ARCHITECTS", label: "Architects", category: "Real Estate & Construction", googleQuery: "architect", osmTags: [{ key: "office", value: "architect" }] },
  { key: "INTERIOR_DESIGN", label: "Interior designers", category: "Real Estate & Construction", googleQuery: "interior designer", osmTags: [{ key: "office", value: "interior_design" }, { key: "craft", value: "interior_decorator" }] },
  { key: "CONSTRUCTION", label: "Construction companies", category: "Real Estate & Construction", googleQuery: "construction company", osmTags: [{ key: "office", value: "construction" }, { key: "craft", value: "builder" }] },

  // === Hospitality & Travel ===
  { key: "HOTELS", label: "Hotels", category: "Hospitality & Travel", googleQuery: "hotel", osmTags: [{ key: "tourism", value: "hotel" }] },
  { key: "RIADS", label: "Riads", category: "Hospitality & Travel", googleQuery: "riad", osmTags: [{ key: "tourism", value: "guest_house" }, { key: "tourism", value: "hotel" }], osmNameFilter: /riad/i },
  { key: "GUEST_HOUSES", label: "Guest houses", category: "Hospitality & Travel", googleQuery: "guest house", osmTags: [{ key: "tourism", value: "guest_house" }] },
  { key: "TRAVEL_AGENCIES", label: "Travel agencies", category: "Hospitality & Travel", googleQuery: "travel agency", osmTags: [{ key: "shop", value: "travel_agency" }] },
  { key: "CAR_RENTAL", label: "Car rental", category: "Hospitality & Travel", googleQuery: "car rental", osmTags: [{ key: "amenity", value: "car_rental" }, { key: "shop", value: "car_rental" }] },

  // === Food & Drink ===
  { key: "RESTAURANTS", label: "Restaurants", category: "Food & Drink", googleQuery: "restaurant", osmTags: [{ key: "amenity", value: "restaurant" }] },
  { key: "CAFES", label: "Cafés", category: "Food & Drink", googleQuery: "cafe", osmTags: [{ key: "amenity", value: "cafe" }] },
  { key: "BAKERIES", label: "Bakeries", category: "Food & Drink", googleQuery: "bakery", osmTags: [{ key: "shop", value: "bakery" }] },
  { key: "PASTRY", label: "Pastry shops", category: "Food & Drink", googleQuery: "pastry shop patisserie", osmTags: [{ key: "shop", value: "pastry" }, { key: "shop", value: "confectionery" }] },

  // === Beauty & Wellness ===
  { key: "BEAUTY", label: "Beauty salons", category: "Beauty & Wellness", googleQuery: "beauty salon", osmTags: [{ key: "shop", value: "beauty" }, { key: "amenity", value: "beauty_salon" }] },
  { key: "BARBERS", label: "Barbers", category: "Beauty & Wellness", googleQuery: "barber shop", osmTags: [{ key: "shop", value: "hairdresser" }] },
  { key: "SPAS", label: "Spas", category: "Beauty & Wellness", googleQuery: "spa hammam", osmTags: [{ key: "leisure", value: "spa" }, { key: "shop", value: "massage" }, { key: "amenity", value: "spa" }] },
  { key: "GYMS", label: "Gyms", category: "Beauty & Wellness", googleQuery: "gym fitness", osmTags: [{ key: "leisure", value: "fitness_centre" }] },
  { key: "YOGA", label: "Yoga studios", category: "Beauty & Wellness", googleQuery: "yoga studio", osmTags: [{ key: "leisure", value: "fitness_centre" }], osmNameFilter: /yoga/i },

  // === Education ===
  { key: "LANGUAGE_CENTERS", label: "Language centers", category: "Education", googleQuery: "language school", osmTags: [{ key: "amenity", value: "language_school" }] },
  { key: "PRIVATE_SCHOOLS", label: "Private schools", category: "Education", googleQuery: "private school", osmTags: [{ key: "amenity", value: "school" }] },
  { key: "DAYCARES", label: "Daycares", category: "Education", googleQuery: "daycare nursery", osmTags: [{ key: "amenity", value: "childcare" }, { key: "amenity", value: "kindergarten" }] },
  { key: "TRAINING_CENTERS", label: "Training centers", category: "Education", googleQuery: "training center vocational", osmTags: [{ key: "amenity", value: "training" }] },

  // === Professional Services ===
  { key: "IT_COMPANIES", label: "IT companies", category: "Professional Services", googleQuery: "IT company software", osmTags: [{ key: "office", value: "it" }] },
  { key: "MARKETING", label: "Marketing agencies", category: "Professional Services", googleQuery: "marketing agency advertising", osmTags: [{ key: "office", value: "advertising_agency" }] },
  { key: "PRINTING", label: "Printing companies", category: "Professional Services", googleQuery: "printing shop", osmTags: [{ key: "shop", value: "copyshop" }, { key: "craft", value: "printer" }] },

  // === Retail ===
  { key: "FURNITURE", label: "Furniture stores", category: "Retail", googleQuery: "furniture store", osmTags: [{ key: "shop", value: "furniture" }] },
  { key: "KITCHEN_STORES", label: "Kitchen stores", category: "Retail", googleQuery: "kitchen store design", osmTags: [{ key: "shop", value: "kitchen" }] },
  { key: "ELECTRONICS", label: "Electronics stores", category: "Retail", googleQuery: "electronics store", osmTags: [{ key: "shop", value: "electronics" }] },
  { key: "OPTICIANS", label: "Opticians", category: "Retail", googleQuery: "optician", osmTags: [{ key: "shop", value: "optician" }] },
  { key: "JEWELRY", label: "Jewelry stores", category: "Retail", googleQuery: "jewelry store", osmTags: [{ key: "shop", value: "jewelry" }] },

  // === Events & Media ===
  { key: "EVENT_AGENCIES", label: "Event agencies", category: "Events & Media", googleQuery: "event planner agency", osmTags: [{ key: "office", value: "event_management" }] },
  { key: "WEDDING_PLANNERS", label: "Wedding planners", category: "Events & Media", googleQuery: "wedding planner", osmTags: [{ key: "office", value: "event_management" }], osmNameFilter: /wedding|mariage/i },
  { key: "PHOTOGRAPHERS", label: "Photographers", category: "Events & Media", googleQuery: "photographer studio", osmTags: [{ key: "shop", value: "photo" }, { key: "craft", value: "photographer" }] },
  { key: "VIDEOGRAPHERS", label: "Videographers", category: "Events & Media", googleQuery: "videographer video production", osmTags: [{ key: "craft", value: "photographer" }], osmNameFilter: /video|film/i },
];

export const CITIES = [
  { key: "MARRAKECH", label: "Marrakech", wikidata: "Q101625" },
  { key: "CASABLANCA", label: "Casablanca", wikidata: "Q11220" },
  { key: "TANGER", label: "Tanger", wikidata: "Q83871" },
  { key: "RABAT", label: "Rabat", wikidata: "Q3551" },
  { key: "AGADIR", label: "Agadir", wikidata: "Q189824" },
  { key: "FES", label: "Fès", wikidata: "Q80985" },
  { key: "MEKNES", label: "Meknès", wikidata: "Q83876" },
  { key: "KENITRA", label: "Kénitra", wikidata: "Q183541" },
  { key: "OUJDA", label: "Oujda", wikidata: "Q193477" },
];

export const NEIGHBORHOODS_MARRAKECH = [
  "Gueliz", "Hivernage", "Medina", "Sidi Ghanem", "Targa", "Mhamid",
  "Hay Hassani", "Daoudiate", "Route de Casablanca", "Route de Safi",
  "Route d'Ourika", "Route de Fès", "Semlalia", "Majorelle", "Agdal",
  "Palmeraie", "Izdihar", "Azli", "Hay Charaf", "Amerchich",
  "Massira", "Ennakhil", "Bab Doukkala",
];

/* ---------- Phone normalization ---------- */

export function normalizePhoneMA(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (digits.startsWith("0")) digits = "+212" + digits.slice(1);
  if (!digits.startsWith("+")) digits = "+212" + digits;
  return digits;
}

function whatsappLinkFromPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

/* ---------- Provider interface + factory ---------- */

export interface DiscoveryProvider {
  name: DiscoveryProviderName;
  search(query: DiscoverySearchQuery): Promise<DiscoveryCandidate[]>;
}

export function getDiscoveryProvider(): DiscoveryProvider {
  if (process.env.GOOGLE_PLACES_API_KEY) return new GooglePlacesProvider(process.env.GOOGLE_PLACES_API_KEY);
  return new OsmProvider();
}

/* ---------- Google Places (New) ---------- */

class GooglePlacesProvider implements DiscoveryProvider {
  readonly name = "GOOGLE" as const;
  constructor(private apiKey: string) {}

  async search(query: DiscoverySearchQuery): Promise<DiscoveryCandidate[]> {
    const city = CITIES.find((c) => c.key === query.city);
    const sector = SECTORS.find((s) => s.key === query.sector);
    if (!city || !sector) return [];

    const parts = [
      sector.googleQuery,
      query.keyword || null,
      "in",
      query.neighborhood ? `${query.neighborhood},` : null,
      city.label,
      "Morocco",
    ].filter(Boolean);
    const textQuery = parts.join(" ");

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.nationalPhoneNumber",
          "places.internationalPhoneNumber",
          "places.websiteUri",
          "places.rating",
          "places.userRatingCount",
          "places.googleMapsUri",
        ].join(","),
      },
      body: JSON.stringify({ textQuery, maxResultCount: 20 }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Google Places returned ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        nationalPhoneNumber?: string;
        internationalPhoneNumber?: string;
        websiteUri?: string;
        rating?: number;
        userRatingCount?: number;
        googleMapsUri?: string;
      }>;
    };

    return (data.places || []).map((p): DiscoveryCandidate => {
      const phone = normalizePhoneMA(p.internationalPhoneNumber || p.nationalPhoneNumber || null);
      return {
        sourceId: p.id,
        source: "GOOGLE",
        name: p.displayName?.text || "Unnamed business",
        sector: sector.key,
        city: city.label,
        neighborhood: query.neighborhood,
        phone,
        // Never derive WhatsApp from a phone — Places has no WhatsApp signal.
        whatsapp: null,
        website: p.websiteUri || null,
        email: null,
        instagram: null,
        facebook: null,
        mapsUrl: p.googleMapsUri || null,
        rating: p.rating || null,
        reviewCount: p.userRatingCount || null,
      };
    });
  }
}

/* ---------- OpenStreetMap (Overpass) ---------- */

// Try main first, fall back to kumi mirror. Both speak the same protocol.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

// Polite, descriptive User-Agent — Overpass blocks bare "node" / empty UAs (returns 406 HTML).
const OVERPASS_UA = "Ibda3OS/1.0 (https://ibda3-digital.vercel.app; contact: ibda3.digital0@gmail.com)";

export type OverpassErrorCode = "OSM_REJECTED" | "OSM_UNAVAILABLE" | "OSM_RATE_LIMITED" | "OSM_TIMEOUT" | "OSM_TOO_BROAD";

export class OverpassError extends Error {
  constructor(public code: OverpassErrorCode, message: string, public endpoint?: string) {
    super(message);
    this.name = "OverpassError";
  }
}

export type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/* ---------- Reliable, observable Overpass fetch (retry + backoff) ----------
 * Non-throwing sibling of callOverpass(): tries each endpoint with a few
 * backed-off retries on throttling/timeouts, and ALWAYS reports what happened
 * (endpoint, status, error, attempts) so the AI-Discovery Debug panel can show
 * the real reason instead of silently returning zero results. Used by the
 * AI-Discovery Overpass provider; the bulk-sweep OsmProvider keeps callOverpass.
 */
export type OsmFetchMeta = {
  elements: OsmElement[];
  endpoint: string | null;
  status: number | null;
  error: string | null;
  attempts: number;
};

const overpassDelay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
// Exponential-ish with jitter: ~0.5s, ~1.5s, ~2.5s.
const overpassBackoff = (attempt: number): number => 500 + attempt * 1000 + Math.floor(Math.random() * 250);

export async function osmFetchWithMeta(queryStr: string, opts?: { retries?: number }): Promise<OsmFetchMeta> {
  const retries = opts?.retries ?? 2;
  let lastStatus: number | null = null;
  let lastError: string | null = null;
  let lastEndpoint: string | null = null;
  let attempts = 0;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      attempts++;
      lastEndpoint = endpoint;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        let res: Response;
        try {
          res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Accept": "application/json",
              "User-Agent": OVERPASS_UA,
            },
            body: "data=" + encodeURIComponent(queryStr),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
        lastStatus = res.status;

        // Retryable: rate-limit / transient upstream. Back off, same endpoint.
        if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
          lastError = `HTTP ${res.status} — Overpass throttled/unavailable`;
          if (attempt < retries) { await overpassDelay(overpassBackoff(attempt)); continue; }
          break; // retries exhausted → next endpoint
        }

        const ct = res.headers.get("content-type") || "";
        const isJson = ct.includes("application/json") || ct.includes("text/javascript");
        if (!res.ok || !isJson) {
          const body = await res.text().catch(() => "");
          const snippet = body.slice(0, 140).replace(/\s+/g, " ").trim();
          lastError = `HTTP ${res.status} — non-JSON response${snippet ? `: ${snippet}` : ""}`;
          // 406 / HTML blocks are sometimes transient — retry once before bailing.
          if ((res.status === 406 || body.startsWith("<!DOCTYPE") || body.includes("<html")) && attempt < retries) {
            await overpassDelay(overpassBackoff(attempt)); continue;
          }
          break;
        }

        const data = (await res.json()) as { elements?: OsmElement[]; remark?: string };
        if (data.remark && /timed out|memory|killed/i.test(data.remark)) {
          lastError = `Overpass exceeded limits (query too broad): ${data.remark}`;
          break; // retrying won't help — try the other endpoint
        }
        return { elements: data.elements || [], endpoint, status: res.status, error: null, attempts };
      } catch (err) {
        const e = err as { name?: string; message?: string };
        lastError = e?.name === "AbortError" ? "Request timed out after 30s" : (e?.message || "network error");
        if (attempt < retries) { await overpassDelay(overpassBackoff(attempt)); continue; }
      }
    }
  }

  return { elements: [], endpoint: lastEndpoint, status: lastStatus, error: lastError ?? "All Overpass endpoints failed", attempts };
}

async function callOverpass(queryStr: string): Promise<OsmElement[]> {
  let lastError: OverpassError | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      // Log the full query so we can debug from server logs.
      console.log(`[overpass] POST ${endpoint}`);
      console.log(`[overpass] query:\n${queryStr}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": OVERPASS_UA,
          },
          body: "data=" + encodeURIComponent(queryStr),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      // Map common error codes to typed errors before reading the body
      if (res.status === 429) {
        lastError = new OverpassError("OSM_RATE_LIMITED", "OpenStreetMap rate-limited the request. Wait a moment and try again.", endpoint);
        continue;
      }
      if (res.status === 504) {
        lastError = new OverpassError("OSM_TIMEOUT", "OpenStreetMap timed out. Try a narrower search or fewer tags.", endpoint);
        continue;
      }
      if (res.status === 504 || res.status === 502 || res.status === 503) {
        lastError = new OverpassError("OSM_UNAVAILABLE", `OpenStreetMap returned ${res.status}.`, endpoint);
        continue;
      }

      const contentType = res.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json") || contentType.includes("text/javascript");

      if (!res.ok || !isJson) {
        // Read the body so we can log it (HTML 406, Cloudflare block, etc.)
        const body = await res.text().catch(() => "");
        const snippet = body.slice(0, 300).replace(/\s+/g, " ").trim();
        console.warn(`[overpass] ${endpoint} responded ${res.status} (${contentType}): ${snippet}`);

        // 406 with HTML body is the classic "User-Agent rejected" / "no acceptable representation" case.
        // The mirror sometimes responds with the same shape — try it before giving up.
        if (res.status === 406 || body.startsWith("<!DOCTYPE") || body.includes("<html")) {
          lastError = new OverpassError(
            "OSM_REJECTED",
            "OpenStreetMap source rejected the query. Try another sector or add Google Places API key.",
            endpoint
          );
          continue;
        }
        lastError = new OverpassError("OSM_UNAVAILABLE", `OpenStreetMap returned ${res.status}.`, endpoint);
        continue;
      }

      const data = (await res.json()) as { elements?: OsmElement[]; remark?: string };

      // Overpass uses a `remark` field for runtime errors (timeout/memory) inside a 200 response.
      // These almost always mean the query asked for too much — narrow the search.
      if (data.remark && /timed out|memory|killed/i.test(data.remark)) {
        lastError = new OverpassError("OSM_TOO_BROAD", `Query exceeded limits: ${data.remark}`, endpoint);
        continue;
      }

      console.log(`[overpass] ${endpoint} OK — ${data.elements?.length ?? 0} elements`);
      return data.elements || [];
    } catch (err) {
      if (err instanceof OverpassError) {
        lastError = err;
        continue;
      }
      // Network error / abort — try the next endpoint
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[overpass] ${endpoint} threw: ${message}`);
      lastError = new OverpassError("OSM_UNAVAILABLE", "OpenStreetMap is currently unreachable.", endpoint);
    }
  }

  throw lastError ?? new OverpassError("OSM_UNAVAILABLE", "All OpenStreetMap endpoints failed.");
}

export class OsmProvider implements DiscoveryProvider {
  readonly name = "OSM" as const;

  async search(query: DiscoverySearchQuery): Promise<DiscoveryCandidate[]> {
    const city = CITIES.find((c) => c.key === query.city);
    const sector = SECTORS.find((s) => s.key === query.sector);
    if (!city || !sector) return [];

    // Build tag filter clauses — keep it simple, both node + way, no recursion.
    const tagClauses = sector.osmTags
      .flatMap((t) => [`node["${t.key}"="${t.value}"](area.s);`, `way["${t.key}"="${t.value}"](area.s);`])
      .join("\n  ");

    const queryStr = `[out:json][timeout:25];
area["wikidata"="${city.wikidata}"]->.s;
(
  ${tagClauses}
);
out tags center 60;`;

    const elements = await callOverpass(queryStr);

    let candidates: DiscoveryCandidate[] = [];
    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags["name"] || tags["brand"] || tags["operator"];
      if (!name) continue; // skip unnamed

      // Sector-specific name filter (e.g. riads must include "riad")
      if (sector.osmNameFilter && !sector.osmNameFilter.test(name)) continue;

      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;

      const phoneRaw = tags["phone"] || tags["contact:phone"] || tags["telephone"] || null;
      const phone = normalizePhoneMA(phoneRaw);
      const neighborhood = tags["addr:suburb"] || tags["addr:neighbourhood"] || tags["addr:city"] || null;
      // WhatsApp is ONLY real when the mapper explicitly tagged it — never
      // derived from the phone. Absent tag → null (button stays hidden).
      const whatsappRaw = tags["contact:whatsapp"] || tags["whatsapp"] || null;
      const whatsapp = whatsappRaw ? whatsappLinkFromPhone(normalizePhoneMA(whatsappRaw)) : null;

      candidates.push({
        sourceId: `${el.type}/${el.id}`,
        source: "OSM",
        name,
        sector: sector.key,
        city: city.label,
        neighborhood: query.neighborhood || neighborhood,
        phone,
        whatsapp,
        website: tags["website"] || tags["contact:website"] || null,
        email: tags["email"] || tags["contact:email"] || null,
        instagram: tags["contact:instagram"] || tags["instagram"] || null,
        facebook: tags["contact:facebook"] || null,
        mapsUrl: lat && lon ? `https://www.openstreetmap.org/${el.type}/${el.id}` : null,
        rating: null,
        reviewCount: null,
      });
    }

    // Post-filter by keyword + neighborhood
    if (query.keyword) {
      const k = query.keyword.toLowerCase();
      candidates = candidates.filter((c) => c.name.toLowerCase().includes(k));
    }
    if (query.neighborhood) {
      const n = query.neighborhood.toLowerCase();
      candidates = candidates.filter((c) =>
        !c.neighborhood || c.neighborhood.toLowerCase().includes(n)
      );
    }

    return candidates;
  }
}
