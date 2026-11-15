/**
 * Does this website belong to the business the OSM list names? A conservative check for the Daily Lead Agent.
 *
 * Signals come from the home page the contact step already reads (no extra request): the page title,
 * og:site_name, schema.org names in JSON-LD, and the domain. The OSM name is reduced to its distinctive words
 * ("La Farmacie" → farmacie; "Riad", "Restaurant", "Marrakech"... don't count).
 *
 *   MATCH       a distinctive word of the OSM name is in the title, og:site_name, JSON-LD or domain.
 *   MISMATCH    only on strong evidence: none of those words appear in any signal or anywhere in the page text,
 *               no near-spelling either, and at least two signals agree on a different name.
 *   UNVERIFIED  everything else: too few signals, a name only in the page text, a near-spelling (transliteration),
 *               a non-Latin OSM name, a generic-only name. Never reported as a mismatch.
 * A redirect is not evidence: the signals are read from the page the site finally serves.
 */

export type IdentitySignals = { title: string; ogSiteName: string; ldNames: string[]; host: string; text: string };
export type IdentityStatus = "MATCH" | "UNVERIFIED" | "MISMATCH";
export type Identity = { status: IdentityStatus; siteName: string | null; reason: string };

/** Words that say what or where a business is, not which one. */
const GENERIC = new Set(`
le la les l de du des d et and the of a au aux en el al y un une
restaurant restaurants resto cafe cafes coffee bar lounge rooftop terrasse terrace snack grill brasserie bistro
riad riads dar maison house villa hotel hotels hostel auberge camp kasbah suites resort palais palace
spa hammam beauty salon institut patisserie boulangerie bakery pastry glacier tea the
shop boutique store studio club centre center agence agency cabinet clinique pharmacie
marrakech marrakesh morocco maroc marocain marocaine moroccan medina gueliz hivernage palmeraie
cuisine food officiel official site accueil home welcome bienvenue page
`.trim().split(/\s+/));

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
function decode(s: string): string {
  return s
    .replace(/&#(\d{1,7});/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Lower case, accents off, anything not a letter or digit becomes a space. */
export function normalize(s: string): string {
  return decode(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
}

export function distinctiveWords(name: string): string[] {
  return [...new Set(normalize(name).split(" ").filter((w) => w.length >= 3 && /[a-z]/.test(w) && !GENERIC.has(w)))];
}

const stripTags = (html: string) => html
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ")
  .replace(/<[^>]+>/g, " ");

const ORG_TYPES = /^(Organization|LocalBusiness|Restaurant|CafeOrCoffeeShop|Bakery|FoodEstablishment|Hotel|LodgingBusiness|BedAndBreakfast|Resort|HealthAndBeautyBusiness|DaySpa|BeautySalon|Store|WebSite|TravelAgency)$/;

function ldNames(html: string): string[] {
  const out: string[] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 6 || out.length >= 6 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((n) => visit(n, depth + 1)); return; }
    const o = node as Record<string, unknown>;
    const types = ([] as unknown[]).concat(o["@type"] ?? []).map(String);
    if (typeof o.name === "string" && types.some((t) => ORG_TYPES.test(t))) out.push(o.name.slice(0, 120));
    if (o["@graph"]) visit(o["@graph"], depth + 1);
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    if (m[1].length > 200_000) continue;
    try { visit(JSON.parse(m[1]), 0); } catch { /* broken JSON-LD says nothing */ }
  }
  return [...new Set(out)];
}

/** Identity signals of the page the site actually served. */
export function identitySignals(html: string, finalUrl: string): IdentitySignals {
  const title = decode(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const og = /<meta[^>]+property=["']og:site_name["'][^>]*>/i.exec(html)?.[0] ?? "";
  const ogSiteName = decode(/content=["']([^"']{1,120})["']/i.exec(og)?.[1] ?? "").trim();
  let host = "";
  try { host = new URL(finalUrl).hostname.toLowerCase().replace(/^www\./, ""); } catch { /* none */ }
  return { title, ogSiteName, ldNames: ldNames(html), host, text: normalize(stripTags(html)).slice(0, 200_000) };
}

/** Similar enough to be the same name spelled another way (Marrakchi / Marrakshi, Kosybar / Kozybar). */
function nearSpelling(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 2 || Math.min(a.length, b.length) < 4) return false;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length] <= (Math.max(a.length, b.length) >= 8 ? 2 : 1);
}

/** The label of the domain the site serves, without "www" and the public suffix: "lemarrakchi" for lemarrakchi.com. */
const hostLabel = (host: string) => host.split(".").slice(0, -1).filter((p) => !/^(co|com|net|org|gov|ac)$/.test(p)).join("");

export function assessIdentity(osmName: string, s: IdentitySignals | null): Identity {
  if (!s) return { status: "UNVERIFIED", siteName: null, reason: "The website's own pages weren't read, so its identity wasn't checked." };
  const siteName = s.ogSiteName || s.ldNames.find((n) => distinctiveWords(n).length > 0) || s.title.split(/\s+[|–—-]\s+|\s*[|–—]\s*/)[0].trim() || null;
  const ours = distinctiveWords(osmName);
  if (/[؀-ۿ]/.test(osmName) || ours.length === 0) {
    return { status: "UNVERIFIED", siteName, reason: "The listed name has no distinctive Latin-script word to compare." };
  }

  const label = hostLabel(s.host);
  const signals = [
    { kind: "title", words: distinctiveWords(s.title) },
    { kind: "og:site_name", words: distinctiveWords(s.ogSiteName) },
    ...s.ldNames.map((n) => ({ kind: "structured data", words: distinctiveWords(n) })),
  ].filter((x) => x.words.length > 0);

  const inSignal = (w: string) => signals.some((x) => x.words.includes(w)) || (w.length >= 4 && label.includes(w));
  const hit = ours.find(inSignal);
  if (hit) return { status: "MATCH", siteName, reason: `"${hit}" from the listed name is in the site's ${signals.find((x) => x.words.includes(hit))?.kind ?? "domain"}.` };

  const textWords = new Set(s.text.split(" "));
  if (ours.some((w) => textWords.has(w))) {
    return { status: "UNVERIFIED", siteName, reason: "The listed name appears in the page text but not in the site's title or branding." };
  }
  const siteWords = [...new Set([...signals.flatMap((x) => x.words), ...(label.length >= 4 ? [label] : [])])];
  if (ours.some((o) => siteWords.some((w) => nearSpelling(o, w) || (w.length >= 6 && w.includes(o)) || (o.length >= 6 && o.includes(w))))) {
    return { status: "UNVERIFIED", siteName, reason: "The site's name is spelled close to the listed name; it may be the same business." };
  }

  // Strong evidence: two independent signals agree on a name of their own.
  const sources = [...signals, ...(label.length >= 4 ? [{ kind: "domain", words: [label] }] : [])];
  const agreeing = siteWords.filter((w) => {
    const kinds = new Set(sources.filter((x) => x.words.some((v) => v === w || (x.kind === "domain" && v.includes(w) && w.length >= 4))).map((x) => x.kind));
    return kinds.size >= 2;
  });
  if (agreeing.length > 0 && siteName) {
    return { status: "MISMATCH", siteName, reason: `The site presents itself as "${siteName}" (title, branding and domain), and never mentions "${osmName}".` };
  }
  return { status: "UNVERIFIED", siteName, reason: "The site's name doesn't clearly match or contradict the listed name." };
}
