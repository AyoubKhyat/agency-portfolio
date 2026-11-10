/**
 * Deterministic website checks. Pure: responses in, evidence out, no network and no AI.
 *
 * Every result carries what was actually observed. "unknown" is a real answer: a page rendered by
 * JavaScript has little in its HTML, and a missing tag there proves nothing, so it is never reported
 * as a failure. Observed strings come from the site and stay untrusted wherever they are used.
 */
import { qualityLabelFromScore } from "@/lib/discovery/score";
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
  contactKinds: string[];
  textChars: number;
  scriptCount: number;
  isShell: boolean;
};

export function parsePage(html: string): ParsedPage {
  const noComments = stripComments(html);
  const scriptCount = (noComments.match(/<script\b/gi) ?? []).length;
  const hasStructuredData = /<script\b[^<>]{0,200}application\/ld\+json/i.test(noComments);
  const noScript = stripElement(stripElement(stripElement(noComments, "script"), "style"), "noscript");

  const page: ParsedPage = {
    lang: "", title: "", description: "", hasViewport: false, hasCanonical: false, ogTags: [],
    h1Count: 0, imgTotal: 0, imgMissingAlt: 0, hasStructuredData, contactKinds: [], textChars: 0, scriptCount, isShell: false,
  };
  const contact = new Set<string>();

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
    } else if (tag === "form") {
      contact.add("form");
    } else if (tag === "a") {
      const href = (attrsOf(attrs).href ?? "").toLowerCase();
      if (href.startsWith("tel:")) contact.add("phone");
      if (href.startsWith("mailto:")) contact.add("email");
      if (href.includes("wa.me/") || href.includes("api.whatsapp.com")) contact.add("whatsapp");
    }
  }
  page.contactKinds = [...contact].sort();

  page.textChars = stripTags(noScript).replace(/\s+/g, " ").trim().length;
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
