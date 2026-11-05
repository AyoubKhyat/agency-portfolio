/**
 * Shared Website Auditor: one public page, robots.txt and the sitemap, read through safeFetch.
 * Never throws for anything the site does, and respects robots.txt before reading the page.
 */
import { buildEvidence, fitLabelFor, gapScore, robotsAllows, robotsSitemaps, type AuditInputs, type Evidence } from "./checks";
import { safeFetch as defaultFetch, SafeFetchError, SSRF_CODES, TOTAL_BUDGET_MS, type SafeFetch, type SafeResponse } from "./safe-fetch";

export type { Evidence } from "./checks";

export type AuditOutcome =
  | "COMPLETE"             // page read; the evidence is usable
  | "UNREADABLE"           // site down, broken or answering with an error
  | "ROBOTS_DISALLOWED"    // the site asks automated tools not to read this page
  | "ROBOTS_UNREACHABLE"   // robots.txt answered 5xx, which RFC 9309 treats as disallow
  | "BLOCKED";             // refused for safety (SSRF rules); nothing was read

export type AuditResult = {
  outcome: AuditOutcome;
  targetUrl: string;
  finalUrl: string | null;
  evidence: Evidence[];
  gapScore: number | null;
  fitLabel: "HOT" | "WARM" | "COLD" | null;
  /** The safe-fetch code behind a non-complete outcome. */
  code: string | null;
  durationMs: number;
};

const codeOf = (err: unknown) => (err instanceof SafeFetchError ? err.code : "NETWORK_ERROR");
const isSsrf = (err: unknown) => err instanceof SafeFetchError && SSRF_CODES.includes(err.code);
/** The answers that really mean "this file isn't there". Others, such as 403 or 429, leave it unknown. */
const GONE = [404, 410];

export async function auditWebsite(targetUrl: string, opts: { fetcher?: SafeFetch; now?: () => Date } = {}): Promise<AuditResult> {
  const fetcher = opts.fetcher ?? defaultFetch;
  const started = Date.now();
  const deadlineAt = started + TOTAL_BUDGET_MS;
  const fetchedAt = (opts.now?.() ?? new Date()).toISOString();
  const base: Pick<AuditResult, "targetUrl" | "finalUrl" | "evidence" | "gapScore" | "fitLabel"> = { targetUrl, finalUrl: null, evidence: [], gapScore: null, fitLabel: null };
  const finish = (r: Omit<AuditResult, "durationMs">): AuditResult => ({ ...r, durationMs: Date.now() - started });
  const note = (id: string, check: string, observed: string, sourceUrl: string): Evidence => ({ id, check, status: "unknown", observed, sourceUrl, fetchedAt });

  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    return finish({ ...base, outcome: "BLOCKED", code: "INVALID_URL" });
  }
  const robotsUrl = `${target.origin}/robots.txt`;
  const sitemapUrl = `${target.origin}/sitemap.xml`;

  let robots: SafeResponse | null = null;
  let robotsFound: boolean | null = null;
  try {
    robots = await fetcher(robotsUrl, { kind: "text", deadlineAt });
    robotsFound = robots.status >= 200 && robots.status < 300 ? true : GONE.includes(robots.status) ? false : null;
    if (robots.status >= 500) {
      return finish({ ...base, outcome: "ROBOTS_UNREACHABLE", code: `HTTP_${robots.status}`, evidence: [note("E_ROBOTS", "robots.txt", `HTTP ${robots.status}: page not read`, robotsUrl)] });
    }
  } catch (err) {
    if (isSsrf(err)) return finish({ ...base, outcome: "BLOCKED", code: codeOf(err) });
    const code = codeOf(err);
    // An HTML page served at /robots.txt, common on single-page apps, is simply "no robots.txt".
    if (code === "BAD_CONTENT_TYPE") robotsFound = false;
    else return finish({ ...base, outcome: "UNREADABLE", code, evidence: [note("E_REACHABLE", "Page responds", `Could not connect (${code})`, targetUrl)] });
  }
  if (robots && robotsFound && !robotsAllows(robots.body, target.pathname || "/")) {
    return finish({ ...base, outcome: "ROBOTS_DISALLOWED", code: "ROBOTS_DISALLOWED", evidence: [note("E_ROBOTS", "robots.txt", "Asks automated tools not to read this page: page not read", robotsUrl)] });
  }

  let page: SafeResponse;
  try {
    page = await fetcher(targetUrl, { kind: "html", deadlineAt });
  } catch (err) {
    if (isSsrf(err)) return finish({ ...base, outcome: "BLOCKED", code: codeOf(err) });
    return finish({ ...base, outcome: "UNREADABLE", code: codeOf(err), evidence: [note("E_REACHABLE", "Page responds", `Could not read the page (${codeOf(err)})`, targetUrl)] });
  }

  const optional = async (url: string, kind: "html" | "text", followRedirects: boolean) => {
    try {
      return await fetcher(url, { kind, followRedirects, deadlineAt });
    } catch {
      return null;
    }
  };
  /** The address robots.txt declares, then the usual one. Only a clear "not there" from all of them counts as missing. */
  const checkSitemap = async (): Promise<AuditInputs["sitemap"]> => {
    const declared = robots && robotsFound ? robotsSitemaps(robots.body)[0] : undefined;
    const candidates = declared && declared !== sitemapUrl ? [declared, sitemapUrl] : [sitemapUrl];
    let unsure = false;
    for (const url of candidates) {
      try {
        const res = await fetcher(url, { kind: "sitemap", deadlineAt });
        if (res.status >= 200 && res.status < 300) return { state: "found", url: res.finalUrl };
        if (!GONE.includes(res.status)) unsure = true;
      } catch (err) {
        // An HTML page answering 200, common on single-page apps, is not a sitemap. Anything else proves nothing.
        if (codeOf(err) !== "BAD_CONTENT_TYPE") unsure = true;
      }
    }
    return { state: unsure ? "unknown" : "missing", url: candidates[0] };
  };

  const httpUrl = new URL(page.finalUrl);
  httpUrl.protocol = "http:";
  httpUrl.port = target.port;
  const [httpProbe, sitemap] = await Promise.all([
    optional(httpUrl.href, "html", false),
    checkSitemap(),
  ]);

  const evidence = buildEvidence({ page, httpProbe, robotsFound, robotsUrl, sitemap, fetchedAt });
  const score = gapScore(evidence);
  const ok = page.status >= 200 && page.status < 300;
  return finish({
    outcome: ok ? "COMPLETE" : "UNREADABLE",
    targetUrl,
    finalUrl: page.finalUrl,
    evidence,
    gapScore: ok ? score : null,
    fitLabel: ok ? fitLabelFor(score) : null,
    code: ok ? null : `HTTP_${page.status}`,
  });
}
