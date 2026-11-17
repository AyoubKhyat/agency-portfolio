/**
 * Contact discovery for Daily Lead Agent leads: the business's own website only, through the same safe fetcher
 * as the audit (SSRF rules, timeouts, size limits) and only where robots.txt allows.
 *
 * Reads robots.txt, the home page and at most MAX_EXTRA_PAGES Contact/About pages of the same site, linked from
 * the home page. Keeps only explicit links: WhatsApp (wa.me / api.whatsapp.com with a number in the link),
 * Instagram profiles (an instagram.com/<handle> link), and e-mail addresses from mailto: links. Each one carries
 * the exact page it was found on. Nothing is inferred from a phone number or a name, no social site is fetched,
 * and nothing found here is "verified": a person checks it on the prospect page.
 */
import { anchorHrefs, notARealPage, parsePage, robotsAllows } from "@/lib/website-audit/checks";
import { safeFetch, type SafeFetch, type SafeResponse } from "@/lib/website-audit/safe-fetch";
import { extractContactLinks } from "@/lib/prospect-qualification";
import { identitySignals, type IdentitySignals } from "@/lib/lead-identity";

export const MAX_EXTRA_PAGES = 2;
/** Per site: robots.txt + home + extra pages all have to fit in this. */
export const SITE_BUDGET_MS = 12_000;
const MAX_EMAILS = 5;

export type SiteContact = {
  channel: "WHATSAPP" | "INSTAGRAM" | "EMAIL";
  /** "+212 6..." / "@handle" / "name@domain.ma"; "" when a WhatsApp link hides its number. */
  value: string;
  /** wa.me link, Instagram profile URL, or mailto: address. */
  link: string;
  /** The exact page the link was on. */
  sourceUrl: string;
};

/**
 * A Contact page linked from the home page, and what the audit's own parser saw on it. read: fetched and usable on
 * the same site; complete: not a JavaScript shell or cut off, so an empty `kinds` means none was there.
 */
export type ContactPageCheck = { url: string; read: boolean; complete: boolean; kinds: string[] };

/**
 * signals: identity signals of the home page read here (null when it wasn't read), for lead-identity.ts.
 * homeMs: how long this second home-page request took, a second speed sample for daily-leads-quality.ts.
 * contactPages: the Contact (not About) pages the home page links to, read or not, for daily-leads-quality.ts.
 */
export type SiteContacts = {
  contacts: SiteContact[]; pagesRead: string[]; signals: IdentitySignals | null; homeMs?: number; contactPages?: ContactPageCheck[];
};

/** Contact/About page paths in the languages Marrakech sites use (FR, EN, AR transliterations, ES). */
const PAGE_HINT = /(^|[/_-])(contact|contacts|contactez|contactez-nous|nous-contacter|contact-us|contacto|about|about-us|a-propos|apropos|qui-sommes-nous|notre-histoire)([/_.-]|$)/i;
const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4|mp3)$/i;
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
/** Addresses that are clearly not the business's inbox (site builders, monitoring, placeholders). */
const NOT_BUSINESS_EMAIL = /@(?:example\.(?:com|org|net)|sentry\.io|wixpress\.com|domain\.com|email\.com|yourdomain\.com)$/i;

const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, "");

/** Same-site Contact/About pages linked from the home page, contact pages first, at most `max`. */
export function contactPageLinks(html: string, pageUrl: string, max = MAX_EXTRA_PAGES): string[] {
  let base: URL;
  try { base = new URL(pageUrl); } catch { return []; }
  const found: { url: string; contact: boolean }[] = [];
  for (const href of anchorHrefs(html)) {
    let u: URL;
    try { u = new URL(href, base); } catch { continue; }
    if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    if (bareHost(u.hostname) !== bareHost(base.hostname) || u.username || u.password || u.port !== base.port) continue;
    const path = decodeURIComponent(u.pathname).toLowerCase();
    if (path === "/" || path === base.pathname.toLowerCase() || SKIP_EXT.test(path) || !PAGE_HINT.test(path)) continue;
    u.hash = "";
    const url = u.toString();
    if (found.some((f) => f.url === url)) continue;
    found.push({ url, contact: /contact/.test(path) });
  }
  return found.sort((a, b) => Number(b.contact) - Number(a.contact)).slice(0, max).map((f) => f.url);
}

/** E-mail addresses from mailto: links only (never from page text), lower-cased, with the page they were on. */
export function extractMailtoEmails(html: string, sourceUrl: string): SiteContact[] {
  const out: SiteContact[] = [];
  for (const href of anchorHrefs(html)) {
    if (!/^mailto:/i.test(href)) continue;
    let addr = href.slice(7).split("?")[0];
    try { addr = decodeURIComponent(addr); } catch { continue; }
    for (const one of addr.split(",")) {
      const email = one.trim().toLowerCase();
      if (!EMAIL.test(email) || NOT_BUSINESS_EMAIL.test(email) || out.some((c) => c.value === email)) continue;
      out.push({ channel: "EMAIL", value: email, link: `mailto:${email}`, sourceUrl });
      if (out.length >= MAX_EMAILS) return out;
    }
  }
  return out;
}

function fromPage(page: SafeResponse): SiteContact[] {
  const links = extractContactLinks(page.body, page.finalUrl, "")
    .filter((c) => c.link) // a WhatsApp link without a readable number is not a usable contact
    .map((c): SiteContact => ({ channel: c.channel, value: c.value, link: c.link, sourceUrl: c.sourceUrl }));
  return [...links, ...extractMailtoEmails(page.body, page.finalUrl)];
}

const usable = (p: SafeResponse) => p.status >= 200 && p.status < 300 && !notARealPage(p);

/**
 * Reads the site's own pages for contacts. Never throws: anything that fails just adds nothing.
 * `siteUrl` is the address the audit read completely (its final URL).
 */
export async function discoverSiteContacts(siteUrl: string, deps: { fetcher?: SafeFetch; now?: () => number } = {}): Promise<SiteContacts> {
  const fetcher = deps.fetcher ?? safeFetch;
  const now = deps.now ?? (() => Date.now());
  const deadlineAt = now() + SITE_BUDGET_MS;
  const result: SiteContacts = { contacts: [], pagesRead: [], signals: null };
  let origin: string;
  try { origin = new URL(siteUrl).origin; } catch { return result; }

  // robots.txt first: a 5xx or an unreadable one means "don't read", as in the audit; a 4xx means no rules.
  let robots = "";
  try {
    const r = await fetcher(`${origin}/robots.txt`, { kind: "text", deadlineAt });
    if (r.status >= 500) return result;
    if (r.status >= 200 && r.status < 300) robots = r.body;
  } catch {
    return result;
  }
  const allowed = (url: string) => robotsAllows(robots, new URL(url).pathname || "/");

  const add = (list: SiteContact[]) => {
    for (const c of list) if (!result.contacts.some((x) => x.channel === c.channel && x.link === c.link)) result.contacts.push(c);
  };

  if (!allowed(siteUrl) || now() >= deadlineAt) return result;
  let home: SafeResponse;
  try { home = await fetcher(siteUrl, { kind: "html", deadlineAt }); } catch { return result; }
  if (!usable(home)) return result;
  result.pagesRead.push(home.finalUrl);
  if (typeof home.ms === "number" && Number.isFinite(home.ms)) result.homeMs = home.ms;
  result.signals = identitySignals(home.body, home.finalUrl);
  add(fromPage(home));

  result.contactPages = [];
  for (const url of contactPageLinks(home.body, home.finalUrl)) {
    const isContact = /contact/i.test(new URL(url).pathname);
    const check: ContactPageCheck = { url, read: false, complete: false, kinds: [] };
    if (isContact) result.contactPages.push(check);
    if (now() >= deadlineAt || !allowed(url)) continue;
    try {
      const page = await fetcher(url, { kind: "html", deadlineAt });
      if (!usable(page) || bareHost(new URL(page.finalUrl).hostname) !== bareHost(new URL(home.finalUrl).hostname)) continue;
      result.pagesRead.push(page.finalUrl);
      add(fromPage(page));
      if (isContact) {
        const parsed = parsePage(page.body, page.finalUrl);
        Object.assign(check, { url: page.finalUrl, read: true, complete: !parsed.isShell && !page.truncated, kinds: parsed.contactKinds });
      }
    } catch {
      // one page failing never hides what the others gave
    }
  }
  return result;
}

/** WhatsApp 3 > Instagram 2 > e-mail 1 > nothing 0: how directly the business can be reached. */
export function contactRank(channels: readonly string[]): number {
  if (channels.includes("WHATSAPP")) return 3;
  if (channels.includes("INSTAGRAM")) return 2;
  if (channels.includes("EMAIL")) return 1;
  return 0;
}
