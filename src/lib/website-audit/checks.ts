/**
 * Deterministic website checks. Pure: responses in, evidence out, no network and no AI.
 *
 * Every result carries what was actually observed. "unknown" is a real answer: a page rendered by
 * JavaScript has little in its HTML, and a missing tag there proves nothing, so it is never reported
 * as a failure. Observed strings come from the site and stay untrusted wherever they are used.
 */
import { qualityLabelFromScore } from "@/lib/discovery/score";
import { explicitWhatsAppLink } from "@/lib/contact-check";
import type { SafeResponse } from "./safe-fetch";

export type EvidenceStatus = "pass" | "fail" | "unknown";

export type Evidence = {
  id: string;
  check: string;
  status: EvidenceStatus;
  /** Short, sanitised, and from the site where relevant. */
  observed: string;
  sourceUrl: string;
  fetchedAt: string;
};

const MAX_OBSERVED = 160;
/** The slowest single-sample response we won't call a problem. */
export const SLOW_RESPONSE_MS = 3000;
/** Below this much visible text, with scripts present, the HTML is a shell and body checks prove nothing. */
const SHELL_TEXT_CHARS = 200;

/** Removes control characters and tag-like text, and shortens. Site text is never passed on whole. */
export function sanitizeObserved(text: string, max = MAX_OBSERVED): string {
  const clean = text
    .replace(/<[^>]{0,500}>/g, " ")
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'").replace(/&nbsp;/gi, " ");
}

/**
 * Lower-cases A-Z only. toLowerCase can change a string's length ("İ" becomes two characters), which would
 * shift every position found in the copy away from the original text.
 */
const asciiLower = (s: string) => s.replace(/[A-Z]+/g, (m) => m.toLowerCase());

const TAG_NAME_END = /[\s/>]/;

/** Removes a whole element kind by scanning, not by regex, so a crafted page can't cause backtracking. */
function stripElement(html: string, tag: string): string {
  const lower = asciiLower(html);
  const open = `<${tag}`;
  const close = `</${tag}`;
  let out = "";
  let at = 0;
  let from = 0;
  for (;;) {
    const start = lower.indexOf(open, from);
    if (start < 0) return out + html.slice(at);
    // <styled-box> is not <style>.
    const next = lower[start + open.length];
    if (next !== undefined && !TAG_NAME_END.test(next)) {
      from = start + open.length;
      continue;
    }
    out += html.slice(at, start);
    const end = lower.indexOf(close, start);
    if (end < 0) return out;
    const gt = lower.indexOf(">", end);
    if (gt < 0) return out;
    at = gt + 1;
    from = at;
  }
}

function stripComments(html: string): string {
  let out = "";
  let at = 0;
  for (;;) {
    const start = html.indexOf("<!--", at);
    if (start < 0) return out + html.slice(at);
    out += html.slice(at, start);
    const end = html.indexOf("-->", start + 4);
    if (end < 0) return out;
    at = end + 3;
  }
}

/** One pass, so a page full of unclosed "<" stays linear. */
function stripTags(html: string): string {
  let out = "";
  let at = 0;
  for (;;) {
    const start = html.indexOf("<", at);
    if (start < 0) return out + html.slice(at);
    out += `${html.slice(at, start)} `;
    const end = html.indexOf(">", start);
    if (end < 0) return out;
    at = end + 1;
  }
}

const TAG_NAME = /[a-z][a-z0-9-]{0,30}/iy;
const ATTR = /([a-z_:][a-z0-9_:.-]{0,60})(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/gi;

/**
 * Each opening tag and its raw attributes. A ">" inside a quoted value doesn't end the tag. Every scan that
 * finds no end moves past what it read, so the whole page is read about once, whatever it contains.
 */
function* openingTags(html: string): Generator<{ name: string; attrs: string }> {
  let at = 0;
  for (;;) {
    const start = html.indexOf("<", at);
    if (start < 0) return;
    TAG_NAME.lastIndex = start + 1;
    const name = TAG_NAME.exec(html)?.[0];
    at = start + 1;
    if (!name) continue;
    const attrsStart = start + 1 + name.length;
    let i = attrsStart;
    let afterEquals = false;
    for (;;) {
      const c = html[i];
      if (c === undefined) return; // unclosed: a browser ignores it too
      if (c === ">") {
        yield { name, attrs: html.slice(attrsStart, i) };
        at = i + 1;
        break;
      }
      if (c === "<") {
        at = i;
        break;
      }
      if (afterEquals && (c === '"' || c === "'")) {
        const close = html.indexOf(c, i + 1);
        if (close < 0) return;
        i = close + 1;
        afterEquals = false;
        continue;
      }
      if (c === "=") afterEquals = true;
      else if (!/\s/.test(c)) afterEquals = false;
      i++;
    }
  }
}

function attrsOf(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(ATTR)) out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

export type ParsedPage = {
  lang: string;
  title: string;
  description: string;
  hasViewport: boolean;
  hasCanonical: boolean;
  ogTags: string[];
  h1Count: number;
  imgTotal: number;
  imgMissingAlt: number;
  hasStructuredData: boolean;
  /** What E_CONTACT counts: "email", "form", "phone", "whatsapp" (links, genuine forms, or details in the visible text). */
  contactKinds: string[];
  /** Social profile links (not share buttons), e.g. "facebook", "instagram". Recorded only: E_CONTACT doesn't count them. */
  socialProfiles: string[];
  /** A same-site link to a contact page or section. Recorded only: E_CONTACT doesn't count it. */
  hasContactPageLink: boolean;
  textChars: number;
  scriptCount: number;
  isShell: boolean;
};

/* ───────────────── Contact details ───────────────── */

const EMAIL_ADDRESS = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}$/;
const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,9}/g;
/** Placeholders, site-builder and monitoring addresses, and file names such as logo@2x.png. */
const NOT_A_CONTACT_EMAIL = /@(?:example|exemple|domain|domaine|yourdomain|votredomaine|email|test)\.[a-z]{2,6}$|@(?:sentry\.io|wixpress\.com|cookiebot\.com)$|^(?:your|you|name|nom|user|username|votre|test|email|e-mail)(?:[._-]?(?:name|nom|email|mail))?@|\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|js|json|woff2?)$/i;

/** Moroccan numbers (+212 / 00212 / 0, then 5–7 and 8 digits) and other numbers written with a "+" country code. */
const PHONE_MA = /(?<![\d+])(?:(?:\+|00)212[\s.-]?(?:\(0\)[\s.-]?)?|0)[5-7](?:[\s.-]?\d){8}(?!\d)/g;
const PHONE_INTL = /(?<![\d+])\+(?!212)[1-9]\d{0,2}[\s.-]?(?:\(0\)[\s.-]?)?\d(?:[\s.-]?\d){6,11}(?!\d)/g;
/** Template numbers: the last 8 digits all the same, or a 12345678 run. */
const placeholderNumber = (digits: string) => /^(\d)\1{7}$/.test(digits.slice(-8)) || /12345678|23456789/.test(digits);

function contactEmail(address: string): boolean {
  return EMAIL_ADDRESS.test(address) && !NOT_A_CONTACT_EMAIL.test(address);
}

/** A WhatsApp chat with this business: a number (or a wa.me/wa.link business link), never a share button. */
function isWhatsAppContact(href: string): boolean {
  if (explicitWhatsAppLink(href)) return true;
  let u: URL;
  try { u = new URL(href); } catch { return false; }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const phone = (u.searchParams.get("phone") ?? "").replace(/\D/g, "");
  if (u.protocol === "whatsapp:") return phone.length >= 8;
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if ((host === "api.whatsapp.com" || host === "web.whatsapp.com") && /^\/send\/?$/.test(u.pathname)) return phone.length >= 8;
  if (host === "wa.me") return /^\/(?:\+?[1-9]\d{7,14}|message\/[A-Za-z0-9]{4,})\/?$/.test(u.pathname);
  if (host === "wa.link") return /^\/[A-Za-z0-9]{3,}\/?$/.test(u.pathname);
  return false;
}

/** Social and contact-page links whose URL is parsed, per kind and page. */
const MAX_LINKS_CHECKED = 100;
const SOCIAL_HINT =/facebook\.com|fb\.com|instagram\.com|tiktok\.com|linkedin\.com|youtube\.com|\/\/(?:www\.)?(?:x|twitter)\.com/;
const SOCIAL_HOSTS: Record<string, string> = {
  "facebook.com": "facebook", "m.facebook.com": "facebook", "web.facebook.com": "facebook", "fb.com": "facebook",
  "instagram.com": "instagram", "tiktok.com": "tiktok", "linkedin.com": "linkedin", "youtube.com": "youtube", "x.com": "x", "twitter.com": "x",
};
/** Path starts that are share buttons, posts or app pages, not a profile. */
const NOT_A_PROFILE: Record<string, RegExp> = {
  facebook: /^(?:sharer|sharer\.php|share|share\.php|dialog|plugins|tr|login|login\.php|l\.php|hashtag|groups|events|watch|photo\.php|photo|story\.php|permalink\.php)$/,
  instagram: /^(?:p|reel|reels|explore|accounts|stories|share)$/,
  x: /^(?:intent|share|home|hashtag|search|i|login)$/,
};

/** The social network of a profile link ("facebook", "instagram"…), or null for share buttons and other links. */
function socialProfile(href: string): string | null {
  let u: URL;
  // The base only resolves protocol-relative links (//facebook.com/x), as a browser does; a relative path stays on it.
  try { u = new URL(href, "https://same-site.invalid/"); } catch { return null; }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password) return null;
  const platform = SOCIAL_HOSTS[u.hostname.toLowerCase().replace(/^www\./, "")];
  if (!platform) return null;
  const [first = "", second = ""] = u.pathname.split("/").filter(Boolean).map((s) => s.toLowerCase());
  if (!first) return null;
  if (platform === "tiktok") return first.startsWith("@") && first.length > 1 ? platform : null;
  if (platform === "linkedin") return ["company", "in", "school"].includes(first) && second ? platform : null;
  if (platform === "youtube") return (first.startsWith("@") && first.length > 1) || (["channel", "c", "user"].includes(first) && second) ? platform : null;
  return NOT_A_PROFILE[platform]?.test(first) ? null : platform;
}

const CONTACT_PAGE = /(?:^|[/_#-])(?:contact|contacts|contactez|contactez-nous|nous-contacter|contact-us|contacto)(?:[/_.#-]|$)/i;

/** A link to this site's contact page or section (relative, or absolute on the same host when pageUrl is known). */
function isContactPageLink(href: string, pageUrl?: string): boolean {
  const BASE = "https://same-site.invalid/";
  let u: URL;
  let base: URL;
  try { base = new URL(pageUrl ?? BASE); u = new URL(href, base); } catch { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.hostname.toLowerCase().replace(/^www\./, "") !== base.hostname.toLowerCase().replace(/^www\./, "")) return false;
  if (/\.(?:pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4|mp3)$/i.test(u.pathname)) return false; // a file, not a page
  let path: string;
  try { path = decodeURIComponent(u.pathname + u.hash); } catch { path = u.pathname + u.hash; }
  return CONTACT_PAGE.test(path);
}

const FORM_NOT_CONTACT = /search|recherche|newsletter|subscribe|abonn|login|log-in|signin|sign-in|connexion|password|comment|cart|panier|checkout|coupon|availability|disponibilit/i;
const FORM_CONTACT_HINT = /contact|wpcf7|wpforms|gform|ninja-forms|fluentform|formspree|enquiry|inquiry|devis|quote/i;
/** Forms per page, and tags per form, that are looked at: enough for any real page, bounded on a hostile one. */
const MAX_FORMS = 50;
const MAX_FORM_TAGS = 300;
const CONTACT_FIELD =/e-?mail|courriel|phone|t[ée]l[ée]phone|\btel\b|whatsapp|mobile/i;

/**
 * True when one of the page's forms is a way to write to the business: it has a message box, or it is marked as a
 * contact form and asks for an email or phone. Search, newsletter, login, comment and shop forms don't count.
 * Scans by position (no regex over the page), like the rest of this parser.
 */
function hasContactForm(html: string): boolean {
  const lower = asciiLower(html);
  let from = 0;
  for (let forms = 0; ; ) {
    const start = lower.indexOf("<form", from);
    if (start < 0 || forms >= MAX_FORMS) return false;
    from = start + 5;
    const next = lower[start + 5];
    if (next !== undefined && !TAG_NAME_END.test(next)) continue; // <formula> is not <form>
    const close = lower.indexOf("</form", start);
    // An unclosed form runs to the end of the page: read it once, so many unclosed forms can't make this quadratic.
    from = close < 0 ? html.length : close;
    forms++;
    const tags = openingTags(html.slice(start, from));
    const form = attrsOf(tags.next().value?.attrs ?? "");
    const hint = [form.id, form.class, form.name, form.action, form.role].filter(Boolean).join(" ");
    if (FORM_NOT_CONTACT.test(hint)) continue;
    let textarea = false;
    let contactField = false;
    let excluded = false;
    let seen = 0;
    for (const { name, attrs } of tags) {
      if (++seen > MAX_FORM_TAGS) break; // a real form has a few dozen fields
      const tag = name.toLowerCase();
      if (tag === "textarea") textarea = true;
      if (tag !== "input") continue;
      const a = attrsOf(attrs);
      const type = (a.type ?? "").toLowerCase();
      if (type === "password" || type === "search" || (a.role ?? "").toLowerCase() === "search") { excluded = true; break; }
      if (type === "email" || type === "tel" || CONTACT_FIELD.test(`${a.name ?? ""} ${a.id ?? ""}`)) contactField = true;
    }
    if (!excluded && (textarea || (FORM_CONTACT_HINT.test(hint) && contactField))) return true;
  }
}

/** Phone numbers and email addresses written in the visible text (a footer, a contact block), placeholders left out. */
function textContactKinds(text: string): string[] {
  const out: string[] = [];
  // Only around each "@" (at most 500 of them), so long runs of address-like characters stay linear.
  let at = -1;
  emails: for (let n = 0; n < 500; n++) {
    at = text.indexOf("@", at + 1);
    if (at < 0) break;
    for (const m of text.slice(Math.max(0, at - 64), at + 650).matchAll(EMAIL_IN_TEXT)) {
      if (contactEmail(m[0])) { out.push("email"); break emails; }
    }
  }
  for (const re of [PHONE_MA, PHONE_INTL]) {
    for (const m of text.matchAll(re)) {
      if (!placeholderNumber(m[0].replace(/\D/g, ""))) { out.push("phone"); return out; }
    }
  }
  return out;
}

export function parsePage(html: string, pageUrl?: string): ParsedPage {
  const noComments = stripComments(html);
  const scriptCount = (noComments.match(/<script\b/gi) ?? []).length;
  const hasStructuredData = /<script\b[^<>]{0,200}application\/ld\+json/i.test(noComments);
  const noScript = stripElement(stripElement(stripElement(noComments, "script"), "style"), "noscript");

  const page: ParsedPage = {
    lang: "", title: "", description: "", hasViewport: false, hasCanonical: false, ogTags: [],
    h1Count: 0, imgTotal: 0, imgMissingAlt: 0, hasStructuredData, contactKinds: [], socialProfiles: [], hasContactPageLink: false,
    textChars: 0, scriptCount, isShell: false,
  };
  const contact = new Set<string>();
  const social = new Set<string>();
  let socialChecked = 0;
  let contactChecked = 0;

  const titleStart = noScript.search(/<title\b/i);
  if (titleStart >= 0) {
    const gt = noScript.indexOf(">", titleStart);
    const end = gt >= 0 ? asciiLower(noScript).indexOf("</title", gt) : -1;
    if (end > gt) page.title = sanitizeObserved(decodeEntities(noScript.slice(gt + 1, end)));
  }

  for (const { name: rawName, attrs } of openingTags(noScript)) {
    const tag = rawName.toLowerCase();
    if (tag === "html") {
      page.lang = sanitizeObserved(attrsOf(attrs).lang ?? "", 20);
    } else if (tag === "meta") {
      const a = attrsOf(attrs);
      const name = (a.name ?? "").toLowerCase();
      const property = (a.property ?? "").toLowerCase();
      if (name === "description" && a.content) page.description = sanitizeObserved(a.content);
      if (name === "viewport" && /width\s*=\s*device-width/i.test(a.content ?? "")) page.hasViewport = true;
      const socialTag = property.startsWith("og:") ? property : name.startsWith("og:") ? name : "";
      if (socialTag && a.content) page.ogTags.push(socialTag);
    } else if (tag === "link") {
      const a = attrsOf(attrs);
      if ((a.rel ?? "").toLowerCase().split(/\s+/).includes("canonical") && a.href) page.hasCanonical = true;
    } else if (tag === "h1") {
      page.h1Count++;
    } else if (tag === "img") {
      page.imgTotal++;
      if (!("alt" in attrsOf(attrs))) page.imgMissingAlt++;
    } else if (tag === "a") {
      const href = (attrsOf(attrs).href ?? "").trim();
      const lowerHref = href.toLowerCase();
      if (lowerHref.startsWith("tel:")) {
        if (/\d/.test(href)) contact.add("phone");
      } else if (lowerHref.startsWith("mailto:")) {
        // mailto:?subject=… is a "share by email" button, not an address.
        if (contactEmail(href.slice(7).split("?")[0].split(",")[0].trim())) contact.add("email");
      } else if (/wa\.(?:me|link)|whatsapp/.test(lowerHref) && isWhatsAppContact(href)) {
        contact.add("whatsapp");
      } else if (SOCIAL_HINT.test(lowerHref)) {
        // Cheap text tests first, and a cap on URLs parsed: a real page has a handful of these, a hostile one thousands.
        if (socialChecked++ < MAX_LINKS_CHECKED) {
          const network = socialProfile(href);
          if (network) social.add(network);
        }
      } else if (!page.hasContactPageLink && lowerHref.includes("contact") && contactChecked++ < MAX_LINKS_CHECKED) {
        if (isContactPageLink(href, pageUrl)) page.hasContactPageLink = true;
      }
    }
  }
  if (hasContactForm(noScript)) contact.add("form");

  const text = stripTags(noScript);
  for (const kind of textContactKinds(decodeEntities(text))) contact.add(kind);
  page.contactKinds = [...contact].sort();
  page.socialProfiles = [...social].sort();

  page.textChars = text.replace(/\s+/g, " ").trim().length;
  page.isShell = scriptCount > 0 && page.textChars < SHELL_TEXT_CHARS;
  return page;
}

/** Every link address on the page, read the same way as parsePage: comments, scripts and styles don't count. */
export function anchorHrefs(html: string): string[] {
  const visible = stripElement(stripElement(stripElement(stripComments(html), "script"), "style"), "noscript");
  const out: string[] = [];
  for (const { name, attrs } of openingTags(visible)) {
    if (name.toLowerCase() !== "a") continue;
    const href = (attrsOf(attrs).href ?? "").trim();
    if (href) out.push(href);
  }
  return out;
}

/* ───────────────── robots.txt ───────────────── */

type RobotsRule = { allow: boolean; path: string };

/** The sitemap addresses robots.txt declares. These lines apply to the whole file, whatever group they sit in. */
export function robotsSitemaps(robots: string): string[] {
  const found: string[] = [];
  for (const rawLine of robots.split(/\r?\n/).slice(0, 5000)) {
    const m = /^\s*sitemap\s*:\s*(\S+)/i.exec(rawLine);
    if (m) found.push(m[1]);
  }
  return found;
}

/** RFC 9309 matching: the group naming this agent, otherwise "*"; the longest matching rule wins, Allow on a tie. */
export function robotsAllows(robots: string, path: string, agentToken = "ibda3auditbot"): boolean {
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  let current: { agents: string[]; rules: RobotsRule[] } | null = null;
  let lastWasAgent = false;
  for (const rawLine of robots.split(/\r?\n/).slice(0, 5000)) {
    const line = rawLine.split("#")[0].trim();
    const sep = line.indexOf(":");
    if (sep < 0) continue;
    const key = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      if (current && value) current.rules.push({ allow: key === "allow", path: value });
    } else {
      lastWasAgent = false;
    }
  }
  const named = groups.filter((g) => g.agents.includes(agentToken));
  const chosen = named.length > 0 ? named : groups.filter((g) => g.agents.includes("*"));
  let best: RobotsRule | null = null;
  for (const rule of chosen.flatMap((g) => g.rules)) {
    if (!robotsPathMatches(rule.path, path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}

/** `*` and a trailing `$`, matched in one left-to-right pass with no regular expression built from site text. */
function robotsPathMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const parts = (anchored ? pattern.slice(0, -1) : pattern).split("*");
  let at = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === 0) {
      if (!path.startsWith(part)) return false;
      at = part.length;
    } else {
      const found = path.indexOf(part, at);
      if (found < 0) return false;
      at = found + part.length;
    }
  }
  if (!anchored) return true;
  const last = parts[parts.length - 1];
  return last === "" ? true : path.endsWith(last) && at <= path.length;
}

/* ───────────────── Evidence ───────────────── */

export type AuditInputs = {
  page: SafeResponse;
  /** Plain-http request to the same host, without following redirects. Null when it failed. */
  httpProbe: SafeResponse | null;
  /** True when /robots.txt answered 2xx as text, false when it is definitely absent, null when we can't tell. */
  robotsFound: boolean | null;
  robotsUrl: string;
  /** "unknown" means the check itself failed, for example a timeout: that says nothing about the site. */
  sitemap: { state: "found" | "missing" | "unknown"; url: string };
  fetchedAt: string;
};

export function buildEvidence(input: AuditInputs): Evidence[] {
  const { page, fetchedAt } = input;
  const source = page.finalUrl;
  const parsed = parsePage(page.body);
  const add = (list: Evidence[], id: string, check: string, status: EvidenceStatus, observed: string, sourceUrl = source) =>
    list.push({ id, check, status, observed: sanitizeObserved(observed), sourceUrl, fetchedAt });

  // A missing tag proves nothing if the HTML is a JavaScript shell or was cut off at the size limit.
  const limited = parsed.isShell || page.truncated;
  const absent = (status: EvidenceStatus): EvidenceStatus => (status === "fail" && limited ? "unknown" : status);
  const whyUnknown = page.truncated ? " (page too large to read fully)" : parsed.isShell ? " (page is rendered by JavaScript)" : "";

  const out: Evidence[] = [];
  const ok = page.status >= 200 && page.status < 300;
  add(out, "E_REACHABLE", "Page responds", ok ? "pass" : "fail", `HTTP ${page.status}`);
  const isHttps = source.startsWith("https://");
  // Only the scheme and host: the path and query came from a visitor and prove nothing here.
  add(out, "E_HTTPS", "Final address uses HTTPS", isHttps ? "pass" : "fail", new URL(source).origin);
  if (input.httpProbe) {
    const { status, finalUrl } = input.httpProbe;
    const location = input.httpProbe.headers.location ?? "";
    const upgrades = status >= 300 && status < 400 && /^https:\/\//i.test(location);
    // An error answer shows the probe was refused or the server had a problem, not that the redirect is missing.
    const result: EvidenceStatus = upgrades ? "pass" : status >= 400 ? "unknown" : "fail";
    add(out, "E_HTTP_REDIRECT", "Plain http redirects to https", result, `HTTP ${status}${upgrades ? " to https" : ""}`, finalUrl);
  } else {
    add(out, "E_HTTP_REDIRECT", "Plain http redirects to https", "unknown", "Plain http did not answer");
  }
  add(out, "E_RESPONSE_TIME", "Response time, one sample from our server", page.ms <= SLOW_RESPONSE_MS ? "pass" : "fail", `${page.ms} ms`);
  add(out, "E_PAGE_SIZE", "HTML size", page.truncated ? "fail" : "pass", page.truncated ? `Over ${Math.round(page.bytes / 1000)} KB` : `${Math.round(page.bytes / 1000)} KB`);
  const hsts = !!page.headers["strict-transport-security"];
  if (isHttps) add(out, "E_HSTS", "HSTS header", hsts ? "pass" : "fail", hsts ? "Present" : "Not sent");
  else add(out, "E_HSTS", "HSTS header", "unknown", "Only applies over HTTPS");

  if (!ok) return out; // an error page says nothing about the site's content

  add(out, "E_TITLE", "Page title", parsed.title ? "pass" : absent("fail"), parsed.title ? `"${parsed.title}"` : `None found${whyUnknown}`);
  add(out, "E_DESCRIPTION", "Meta description", parsed.description ? "pass" : absent("fail"), parsed.description ? `"${parsed.description}"` : `None found${whyUnknown}`);
  add(out, "E_VIEWPORT", "Mobile viewport tag", parsed.hasViewport ? "pass" : absent("fail"), parsed.hasViewport ? "Present" : `None found${whyUnknown}`);
  add(out, "E_LANG", "Page language declared", parsed.lang ? "pass" : absent("fail"), parsed.lang ? `lang="${parsed.lang}"` : `None found${whyUnknown}`);
  add(out, "E_CANONICAL", "Canonical link", parsed.hasCanonical ? "pass" : absent("fail"), parsed.hasCanonical ? "Present" : `None found${whyUnknown}`);
  add(out, "E_OPEN_GRAPH", "Social sharing tags", parsed.ogTags.length > 0 ? "pass" : absent("fail"), parsed.ogTags.length > 0 ? `${parsed.ogTags.length} found` : `None found${whyUnknown}`);
  add(out, "E_STRUCTURED_DATA", "Structured data", parsed.hasStructuredData ? "pass" : absent("fail"), parsed.hasStructuredData ? "Present" : `None found${whyUnknown}`);

  add(out, "E_H1", "Main heading (H1)", parsed.h1Count === 1 ? "pass" : absent("fail"), parsed.h1Count === 0 ? `None found${whyUnknown}` : `${parsed.h1Count} found`);
  if (parsed.imgTotal > 0) {
    add(out, "E_IMAGE_ALT", "Images with alt text", parsed.imgMissingAlt === 0 ? "pass" : absent("fail"), `${parsed.imgMissingAlt} of ${parsed.imgTotal} without alt`);
  } else {
    add(out, "E_IMAGE_ALT", "Images with alt text", "unknown", "No images in the HTML");
  }
  add(out, "E_CONTACT", "Contact link or form on the page", parsed.contactKinds.length > 0 ? "pass" : absent("fail"), parsed.contactKinds.length > 0 ? parsed.contactKinds.join(", ") : `None found${whyUnknown}`);

  if (input.robotsFound === null) add(out, "E_ROBOTS", "robots.txt", "unknown", "Could not check", input.robotsUrl);
  else add(out, "E_ROBOTS", "robots.txt", input.robotsFound ? "pass" : "fail", input.robotsFound ? "Found" : "Not found", input.robotsUrl);
  const { state, url } = input.sitemap;
  if (state === "unknown") add(out, "E_SITEMAP", "Sitemap", "unknown", "Could not check", url);
  else add(out, "E_SITEMAP", "Sitemap", state === "found" ? "pass" : "fail", state === "found" ? "Found" : "Not found", url);
  return out;
}

/* ───────────────── Not the site's real page ───────────────── */

/** Set by these services only when they stopped the request, so they count whatever the status or body. */
const BOT_CHECK_HEADERS = ["x-amzn-waf-action", "cf-mitigated", "x-vercel-mitigated"];
/** Only read on pages with little visible text: a real article may well mention a captcha. */
const BOT_CHECK_BODY = /awswaf|_cf_chl_opt|cf-chl-|captcha-delivery\.com|_incapsula_resource|px-captcha|verify you are (?:a )?human|checking your browser|are you a robot|just a moment\.\.\.|attention required|access denied/i;
const BOT_CHECK_MAX_TEXT_CHARS = 500;
/** Success codes that don't deliver a page. */
const NO_PAGE_STATUSES = [202, 204, 205];

export type NotARealPage = { code: "BOT_CHALLENGE" | "NO_PAGE_CONTENT"; observed: string };

/**
 * A bot check or an empty answer says nothing about the site, and its headers and tags aren't the site's.
 * Being wrong here is cheap: the run stays audit-only and someone looks at the site by hand.
 */
export function notARealPage(page: SafeResponse): NotARealPage | null {
  const challenge: NotARealPage = { code: "BOT_CHALLENGE", observed: `HTTP ${page.status}: a bot check answered instead of the site, so its content wasn't checked` };
  if (BOT_CHECK_HEADERS.some((h) => page.headers[h])) return challenge;
  const parsed = parsePage(page.body);
  if (parsed.textChars < BOT_CHECK_MAX_TEXT_CHARS && BOT_CHECK_BODY.test(page.body)) return challenge;
  const nothingThere = parsed.textChars === 0 && parsed.scriptCount === 0 && parsed.imgTotal === 0;
  if (NO_PAGE_STATUSES.includes(page.status) || (page.status >= 200 && page.status < 300 && nothingThere)) {
    return { code: "NO_PAGE_CONTENT", observed: `HTTP ${page.status}: no page content was returned, so nothing could be checked` };
  }
  return null;
}

/** What the page itself shows. Reachability, headers, robots.txt and the sitemap say nothing about its content. */
const CONTENT_CHECKS = ["E_TITLE", "E_DESCRIPTION", "E_VIEWPORT", "E_LANG", "E_CANONICAL", "E_OPEN_GRAPH", "E_STRUCTURED_DATA", "E_H1", "E_IMAGE_ALT", "E_CONTACT"];
export const MIN_KNOWN_CONTENT_CHECKS = 5;

/** Below this, a score or a draft would rest on server settings rather than on the page. */
export function hasEnoughContentEvidence(evidence: Evidence[]): boolean {
  return evidence.filter((e) => CONTENT_CHECKS.includes(e.id) && e.status !== "unknown").length >= MIN_KNOWN_CONTENT_CHECKS;
}

/** Share of checks with a known answer that failed. Internal only, and null when too little is known. */
export function gapScore(evidence: Evidence[]): number | null {
  const known = evidence.filter((e) => e.status !== "unknown");
  if (known.length < 5) return null;
  return Math.round((100 * known.filter((e) => e.status === "fail").length) / known.length);
}

export function fitLabelFor(score: number | null): "HOT" | "WARM" | "COLD" | null {
  return score === null ? null : qualityLabelFromScore(score);
}
