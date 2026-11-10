/**
 * Prospect qualification (P6A): check one business website before anyone contacts it.
 *
 * Reuses the safe Website Auditor (robots.txt, SSRF rules, evidence), the discovery contact repair helpers and the
 * prospect duplicate classifier. It reads, it never writes: no AI, no message, no prospect is created.
 *
 * A WhatsApp or Instagram link found on the site is FOUND_ON_SITE: the site links to it, with the page as proof.
 * That is not VERIFIED. Only a person can mark a contact VERIFIED, on the prospect record, as before.
 */
import { auditWebsite, type AuditOutcome } from "@/lib/website-audit";
import { anchorHrefs, type Evidence } from "@/lib/website-audit/checks";
import type { SafeFetch } from "@/lib/website-audit/safe-fetch";
import { normalizeSiteUrl } from "@/lib/diagnosis";
import { buildWhatsAppUrl, repairInstagram, repairPhone } from "@/lib/discovery/validate";
import { classify } from "@/lib/discovery/duplicates";
import type { DiscoveryCandidate } from "@/lib/discovery/types";

export const FOUND_ON_SITE = "FOUND_ON_SITE";
/** Enough for any real site; a page linking more is not giving us one business's contacts. */
const MAX_PER_CHANNEL = 10;
const MAX_MATCHES = 5;

export type FoundContact = {
  channel: "WHATSAPP" | "INSTAGRAM";
  /** "+212 6 25 46 16 45" or "@handle"; empty when the link doesn't show one. Never guessed. */
  value: string;
  /** A clean link to it, without any pre-filled text from the site. */
  link: string;
  note: string | null;
  status: typeof FOUND_ON_SITE;
  sourceUrl: string;
  fetchedAt: string;
};

const IG_HOSTS = ["instagram.com", "m.instagram.com", "instagr.am"];
/** Instagram paths that are pages of Instagram itself, not an account. */
const IG_RESERVED = new Set(["p", "reel", "reels", "tv", "explore", "stories", "accounts", "direct", "about", "developer", "legal", "web", "share", "s"]);
const PHONE_LIKE = /^\+?[\d\s().-]{8,24}$/;

function whatsappContact(url: URL): Pick<FoundContact, "value" | "link" | "note"> | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let raw: string | null = null;
  if (url.protocol === "whatsapp:") {
    raw = url.searchParams.get("phone");
  } else if (host === "wa.me") {
    const seg = url.pathname.split("/").filter(Boolean);
    if (seg[0] === "message") {
      return /^[A-Za-z0-9]{1,40}$/.test(seg[1] ?? "")
        ? { value: "", link: `https://wa.me/message/${seg[1]}`, note: "Short link: the number isn't shown" }
        : null;
    }
    if (seg.length !== 1) return null;
    raw = decodeURIComponent(seg[0]);
  } else if ((host === "api.whatsapp.com" || host === "web.whatsapp.com") && /^\/send\/?$/.test(url.pathname)) {
    raw = url.searchParams.get("phone");
  } else {
    return null; // chat.whatsapp.com is a group invite, not the business's number
  }
  // wa.me takes international digits. A leading 0 is a national number whose country we'd have to guess.
  const digits = raw && PHONE_LIKE.test(raw.trim()) ? raw.replace(/\D/g, "") : "";
  const phone = digits && !digits.startsWith("0") ? repairPhone(`+${digits}`) : null;
  if (!phone?.valid) return { value: "", link: "", note: "WhatsApp link without a readable number" };
  return { value: phone.phone, link: buildWhatsAppUrl(phone.e164), note: null };
}

function instagramContact(url: URL): Pick<FoundContact, "value" | "link" | "note"> | null {
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!IG_HOSTS.includes(url.hostname.toLowerCase().replace(/^www\./, ""))) return null;
  const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
  if (!first || IG_RESERVED.has(first.toLowerCase())) return null;
  const ig = repairInstagram(first);
  return ig.valid ? { value: `@${ig.handle}`, link: ig.url, note: null } : null;
}

/** WhatsApp and Instagram links on the page, each with the page it was found on. */
export function extractContactLinks(html: string, sourceUrl: string, fetchedAt: string): FoundContact[] {
  const out: FoundContact[] = [];
  const seen = new Set<string>();
  const count = { WHATSAPP: 0, INSTAGRAM: 0 };
  for (const href of anchorHrefs(html)) {
    let url: URL;
    try {
      url = new URL(href, sourceUrl);
    } catch {
      continue;
    }
    const wa = whatsappContact(url);
    const found = wa ? { channel: "WHATSAPP" as const, ...wa } : (() => {
      const ig = instagramContact(url);
      return ig ? { channel: "INSTAGRAM" as const, ...ig } : null;
    })();
    if (!found) continue;
    const key = `${found.channel}|${found.value}|${found.link}|${found.note ?? ""}`;
    if (seen.has(key) || count[found.channel] >= MAX_PER_CHANNEL) continue;
    seen.add(key);
    count[found.channel]++;
    out.push({ ...found, status: FOUND_ON_SITE, sourceUrl, fetchedAt });
  }
  return out;
}

/* ───────────────── Duplicates ───────────────── */

export type ProspectRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  whatsappLink: string;
  /** Set by a person on the prospect record. The only place VERIFIED comes from. */
  whatsappStatus: string;
  instagramStatus: string;
};

export type ProspectMatch = {
  prospectId: string;
  prospectName: string;
  status: "EXISTS" | "POSSIBLE";
  reasons: string[];
  whatsappStatus: string;
  instagramStatus: string;
};

export type DuplicateSignals = { websites: string[]; phones: string[]; instagramHandles: string[] };

const blank: DiscoveryCandidate = { name: "", website: "", phone: "", email: "", instagram: "", city: "", country: "", sector: "", sourceUrl: "" };

/** Existing prospects that share the site's domain, a number it links to, or an Instagram account it links to. */
export function matchProspects(signals: DuplicateSignals, existing: ProspectRow[]): ProspectMatch[] {
  const matches = new Map<string, ProspectMatch>();
  const add = (p: ProspectRow, status: "EXISTS" | "POSSIBLE", reason: string) => {
    const m = matches.get(p.id);
    if (!m) matches.set(p.id, { prospectId: p.id, prospectName: p.name, status, reasons: [reason], whatsappStatus: p.whatsappStatus, instagramStatus: p.instagramStatus });
    else if (!m.reasons.includes(reason)) m.reasons.push(reason);
  };
  /** The shared classifier stops at its first match, so run it again without the ones already found. */
  const classifyAll = (candidate: DiscoveryCandidate, rows: ProspectRow[], relabel?: string) => {
    let pool = rows;
    for (let i = 0; i < MAX_MATCHES; i++) {
      const r = classify(candidate, pool);
      if (r.status === "NEW" || !r.prospectId) return;
      const p = rows.find((row) => row.id === r.prospectId);
      if (p) add(p, r.status, relabel ?? r.reason ?? "Match");
      pool = pool.filter((row) => row.id !== r.prospectId);
    }
  };
  // The classifier compares a prospect's phone field; its WhatsApp link holds a number too.
  const byWhatsApp = existing.map((p) => ({ ...p, phone: p.whatsappLink.replace(/\D/g, "") }));
  for (const website of signals.websites) classifyAll({ ...blank, website }, existing);
  for (const phone of signals.phones) {
    classifyAll({ ...blank, phone }, existing);
    classifyAll({ ...blank, phone }, byWhatsApp, "Same WhatsApp number");
  }
  for (const handle of signals.instagramHandles) {
    for (const p of existing) if (repairInstagram(p.instagram).handle === handle) add(p, "EXISTS", "Same Instagram account");
  }
  return [...matches.values()].slice(0, MAX_MATCHES * 3);
}

async function loadProspectsFromDb(): Promise<ProspectRow[] | null> {
  const { prisma, hasPrisma } = await import("@/lib/prisma");
  if (!hasPrisma()) return null;
  return prisma.prospect.findMany({
    select: { id: true, name: true, phone: true, email: true, website: true, instagram: true, whatsappLink: true, whatsappStatus: true, instagramStatus: true },
    take: 5000, // the same limit as the discovery duplicate check
  });
}

/* ───────────────── The check ───────────────── */

export type ProblemEvidence = Pick<Evidence, "id" | "check" | "observed" | "sourceUrl" | "fetchedAt">;

export type QualificationResult = {
  targetUrl: string;
  finalUrl: string | null;
  outcome: AuditOutcome;
  code: string | null;
  durationMs: number;
  gapScore: number | null;
  fitLabel: "HOT" | "WARM" | "COLD" | null;
  /** Checks that failed, each with what was seen and where. */
  problems: ProblemEvidence[];
  /** Checks we couldn't decide. Not problems. */
  unknown: ProblemEvidence[];
  passed: number;
  contacts: FoundContact[];
  duplicates: { checked: true; matches: ProspectMatch[] } | { checked: false; reason: string };
};

export type QualifyDeps = { fetcher?: SafeFetch; loadProspects?: () => Promise<ProspectRow[] | null> };

export class InvalidUrlError extends Error {
  constructor() {
    super("Not a public website address");
    this.name = "InvalidUrlError";
  }
}

const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "").toLowerCase() : null;
  } catch {
    return null;
  }
};

export async function qualifyWebsite(input: string, deps: QualifyDeps = {}): Promise<QualificationResult> {
  const targetUrl = normalizeSiteUrl(input);
  if (!targetUrl) throw new InvalidUrlError();

  let contacts: FoundContact[] = [];
  const audit = await auditWebsite(targetUrl, {
    fetcher: deps.fetcher,
    onPage: (page, fetchedAt) => {
      if (page.status >= 200 && page.status < 300) contacts = extractContactLinks(page.body, page.finalUrl, fetchedAt);
    },
  });

  const pick = ({ id, check, observed, sourceUrl, fetchedAt }: Evidence): ProblemEvidence => ({ id, check, observed, sourceUrl, fetchedAt });
  const websites = [...new Set([hostOf(targetUrl), hostOf(audit.finalUrl)].filter((h): h is string => !!h))];
  const signals: DuplicateSignals = {
    websites,
    phones: contacts.filter((c) => c.channel === "WHATSAPP" && c.value).map((c) => c.value),
    instagramHandles: contacts.filter((c) => c.channel === "INSTAGRAM").map((c) => c.value.slice(1)),
  };

  let duplicates: QualificationResult["duplicates"];
  try {
    const rows = await (deps.loadProspects ?? loadProspectsFromDb)();
    duplicates = rows ? { checked: true, matches: matchProspects(signals, rows) } : { checked: false, reason: "No database connected" };
  } catch {
    duplicates = { checked: false, reason: "The CRM could not be read" };
  }

  return {
    targetUrl,
    finalUrl: audit.finalUrl,
    outcome: audit.outcome,
    code: audit.code,
    durationMs: audit.durationMs,
    gapScore: audit.gapScore,
    fitLabel: audit.fitLabel,
    problems: audit.evidence.filter((e) => e.status === "fail").map(pick),
    unknown: audit.evidence.filter((e) => e.status === "unknown").map(pick),
    passed: audit.evidence.filter((e) => e.status === "pass").length,
    contacts,
    duplicates,
  };
}
