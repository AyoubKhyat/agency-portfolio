/**
 * The only way the Website Auditor reaches the network. Addresses are typed by website visitors, so
 * every request is treated as hostile:
 *   - GET only, http(s) only, ports 80/443 only, no credentials, no cookies, no shared connections
 *   - every DNS answer is checked, and the socket connects to the address that was checked, through
 *     Node's `lookup` hook, so a name cannot change between the check and the connection
 *   - redirects are followed by hand, at most MAX_REDIRECTS, each hop checked from scratch
 *   - limited in time (per hop and overall) and size (counted after decompression)
 *
 * createSafeFetcher's options exist so tests can use local sites. Production code uses `safeFetch`,
 * which takes no options; tests/safe-fetch.test.ts checks that nothing else passes them.
 */
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Readable } from "node:stream";
import { normalizeSiteUrl } from "@/lib/diagnosis";

export const MAX_REDIRECTS = 3;
export const HOP_TIMEOUT_MS = 6_000;
export const TOTAL_BUDGET_MS = 15_000;
export const MAX_BODY_BYTES = 1_500_000;
/** Sites may redirect to addresses far longer than a visitor could type, and that alone is harmless. */
export const MAX_REDIRECT_URL_CHARS = 2000;
export const AUDIT_USER_AGENT = "Ibda3AuditBot/1.0 (+https://www.ibda3digital.com)";

export type SafeFetchCode =
  | "INVALID_URL" | "BLOCKED_HOST" | "BLOCKED_PORT" | "BLOCKED_ADDRESS" | "BLOCKED_REDIRECT" | "REDIRECT_TOO_LONG"
  | "DNS_FAILED" | "TOO_MANY_REDIRECTS" | "TIMEOUT" | "BAD_CONTENT_TYPE" | "TLS_ERROR" | "NETWORK_ERROR";

/** Refused for safety, as opposed to the site simply being unavailable. */
export const SSRF_CODES: readonly SafeFetchCode[] = ["INVALID_URL", "BLOCKED_HOST", "BLOCKED_PORT", "BLOCKED_ADDRESS", "BLOCKED_REDIRECT"];

export class SafeFetchError extends Error {
  constructor(public readonly code: SafeFetchCode, message?: string) {
    super(message ?? code);
    this.name = "SafeFetchError";
  }
}

export type ContentKind = "html" | "text" | "sitemap";

export type SafeResponse = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  /** The body hit MAX_BODY_BYTES and the rest was not read. */
  truncated: boolean;
  ms: number;
  hops: { url: string; status: number }[];
};

export type SafeFetch = (url: string, opts: { kind: ContentKind; followRedirects?: boolean; deadlineAt?: number }) => Promise<SafeResponse>;

/* ───────────────── Address rules ───────────────── */

// Two lists on purpose: BlockList also applies IPv6 rules to IPv4 addresses, through their mapped form.
const blockedV4 = new BlockList();
const blockedV6 = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.31.196.0", 24], ["192.52.193.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["192.175.48.0", 24], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockedV4.addSubnet(net, bits, "ipv4");
// Only global unicast (2000::/3) is reachable in IPv6, minus its tunnelling and documentation ranges.
for (const [net, bits] of [
  ["::", 3], ["4000::", 2], ["8000::", 1],
  ["2001::", 32], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
] as const) blockedV6.addSubnet(net, bits, "ipv6");

/** False for anything not on the public internet, and for anything that isn't an IP address at all. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, "ipv4");
  // IPv4-mapped addresses fall inside ::/3, so they are refused rather than unpacked.
  if (family === 6) return !blockedV6.check(address, "ipv6");
  return false;
}

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home", ".corp", ".home.arpa", ".test", ".example", ".invalid", ".onion"];

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || BLOCKED_SUFFIXES.some((s) => h.endsWith(s));
}

/* ───────────────── Fetcher ───────────────── */

export type SafeFetcherConfig = {
  isAllowedAddress: (address: string) => boolean;
  isAllowedHostname: (host: string) => boolean;
  allowedPorts: readonly number[];
  resolve: (host: string) => Promise<{ address: string; family: number }[]>;
  hopTimeoutMs: number;
  maxBodyBytes: number;
};

const ACCEPTED: Record<ContentKind, RegExp> = {
  html: /^(text\/html|application\/xhtml\+xml)\b/i,
  text: /^(text\/plain|text\/xml|application\/xml)\b/i,
  // Sitemaps may be compressed files or feeds. Only their existence is used, never their content.
  sitemap: /^(text\/plain|text\/xml|application\/xml|application\/(?:x-)?gzip|application\/octet-stream|application\/rss\+xml|application\/atom\+xml)(?:\s*;|\s*$)/i,
};

const ACCEPT: Record<ContentKind, string> = {
  html: "text/html,application/xhtml+xml",
  text: "text/plain,text/xml,application/xml",
  sitemap: "application/xml,text/xml,text/plain,application/gzip,application/x-gzip,*/*;q=0.1",
};

function decoderFor(contentType: string): TextDecoder {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  try {
    return new TextDecoder(charset ?? "utf-8");
  } catch {
    return new TextDecoder("utf-8");
  }
}

function flattenHeaders(h: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) if (v !== undefined) out[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v;
  return out;
}

export function createSafeFetcher(overrides: Partial<SafeFetcherConfig> = {}): SafeFetch {
  const config: SafeFetcherConfig = {
    isAllowedAddress: isPublicAddress,
    isAllowedHostname: (h) => !isBlockedHostname(h),
    allowedPorts: [80, 443],
    resolve: (host) => dnsLookup(host, { all: true, verbatim: true }),
    hopTimeoutMs: HOP_TIMEOUT_MS,
    maxBodyBytes: MAX_BODY_BYTES,
    ...overrides,
  };

  function validate(raw: string, maxChars?: number): URL {
    const normalized = normalizeSiteUrl(raw, maxChars);
    if (!normalized) throw new SafeFetchError("INVALID_URL");
    const url = new URL(normalized);
    url.hash = "";
    if (!config.isAllowedHostname(url.hostname)) throw new SafeFetchError("BLOCKED_HOST");
    const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
    if (!config.allowedPorts.includes(port)) throw new SafeFetchError("BLOCKED_PORT");
    return url;
  }

  /** Called by the socket when it connects: the addresses returned here are the only ones it can use. */
  const checkedLookup = ((hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
    config.resolve(hostname).then(
      (answers) => {
        if (answers.length === 0) return callback(new SafeFetchError("DNS_FAILED"));
        if (answers.some((a) => !config.isAllowedAddress(a.address))) return callback(new SafeFetchError("BLOCKED_ADDRESS"));
        if (options.all) return callback(null, answers);
        callback(null, answers[0].address, answers[0].family);
      },
      () => callback(new SafeFetchError("DNS_FAILED")),
    );
  }) as unknown as http.RequestOptions["lookup"];

  function oneHop(url: URL, kind: ContentKind, timeoutMs: number): Promise<{ status: number; headers: Record<string, string>; body: string; bytes: number; truncated: boolean; location?: string }> {
    return new Promise((resolve, reject) => {
      const transport = url.protocol === "https:" ? https : http;
      let finished = false;
      const finish = (fn: () => void) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        fn();
      };
      const req = transport.request(url, {
        method: "GET",
        agent: false, // a fresh connection, so a socket opened for another host can never be reused
        lookup: checkedLookup,
        headers: {
          "User-Agent": AUDIT_USER_AGENT,
          Accept: ACCEPT[kind],
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "close",
        },
      });
      // Covers DNS, connection, headers and the whole body, so a slow-drip response can't outlast it.
      const timer = setTimeout(() => finish(() => { req.destroy(); reject(new SafeFetchError("TIMEOUT")); }), timeoutMs);

      req.on("error", (err: NodeJS.ErrnoException) => finish(() => {
        if (err instanceof SafeFetchError) return reject(err);
        const code = (err.cause as NodeJS.ErrnoException | undefined)?.code ?? err.code ?? "";
        if (err.cause instanceof SafeFetchError) return reject(err.cause);
        if (code === "ENOTFOUND" || code === "EAI_AGAIN") return reject(new SafeFetchError("DNS_FAILED"));
        if (/^(CERT_|ERR_TLS|ERR_SSL|DEPTH_ZERO|SELF_SIGNED|UNABLE_TO_|HOSTNAME_MISMATCH)/.test(code) || /EPROTO/.test(code)) return reject(new SafeFetchError("TLS_ERROR"));
        reject(new SafeFetchError("NETWORK_ERROR"));
      }));

      req.on("response", (res) => {
        // Second look at the far end, in case a connection ever arrived some other way.
        const remote = res.socket?.remoteAddress;
        if (remote && !config.isAllowedAddress(remote.replace(/^::ffff:/, ""))) {
          res.destroy();
          req.destroy();
          return finish(() => reject(new SafeFetchError("BLOCKED_ADDRESS")));
        }
        const status = res.statusCode ?? 0;
        const headers = flattenHeaders(res.headers);
        if (status >= 300 && status < 400 && headers.location) {
          res.destroy();
          req.destroy();
          return finish(() => resolve({ status, headers, body: "", bytes: 0, truncated: false, location: headers.location }));
        }
        const contentType = headers["content-type"] ?? "";
        if (status >= 200 && status < 300 && !ACCEPTED[kind].test(contentType)) {
          res.destroy();
          req.destroy();
          return finish(() => reject(new SafeFetchError("BAD_CONTENT_TYPE")));
        }

        const encoding = (headers["content-encoding"] ?? "").toLowerCase();
        let stream: Readable = res;
        if (encoding === "gzip" || encoding === "x-gzip") stream = res.pipe(createGunzip());
        else if (encoding === "deflate") stream = res.pipe(createInflate());
        else if (encoding === "br") stream = res.pipe(createBrotliDecompress());

        const chunks: Buffer[] = [];
        let bytes = 0;
        const done = (truncated: boolean) => finish(() => {
          const text = decoderFor(contentType).decode(Buffer.concat(chunks));
          if (stream !== res) stream.destroy(); // stops the decompressor, not just the download
          res.destroy();
          req.destroy();
          resolve({ status, headers, body: text, bytes, truncated });
        });
        // Counted after decompression, so a small compressed bomb stops at the same limit.
        stream.on("data", (chunk: Buffer) => {
          if (finished) return;
          const room = config.maxBodyBytes - bytes;
          if (chunk.length >= room) {
            chunks.push(chunk.subarray(0, room));
            bytes += room;
            return done(true);
          }
          chunks.push(chunk);
          bytes += chunk.length;
        });
        stream.on("end", () => done(false));
        stream.on("error", () => finish(() => { req.destroy(); reject(new SafeFetchError("NETWORK_ERROR")); }));
        res.on("error", () => finish(() => { req.destroy(); reject(new SafeFetchError("NETWORK_ERROR")); }));
      });

      req.end();
    });
  }

  return async function safeFetchImpl(raw, { kind, followRedirects = true, deadlineAt }) {
    const started = Date.now();
    const deadline = deadlineAt ?? started + TOTAL_BUDGET_MS;
    const hops: { url: string; status: number }[] = [];
    let url = validate(raw);
    for (let redirects = 0; ; redirects++) {
      const left = deadline - Date.now();
      if (left <= 0) throw new SafeFetchError("TIMEOUT");
      const res = await oneHop(url, kind, Math.min(left, config.hopTimeoutMs));
      hops.push({ url: url.href, status: res.status });
      if (res.location === undefined || !followRedirects) {
        return {
          requestedUrl: raw, finalUrl: url.href, status: res.status, headers: res.headers, body: res.body,
          bytes: res.bytes, truncated: res.truncated, ms: Date.now() - started, hops,
        };
      }
      if (redirects >= MAX_REDIRECTS) throw new SafeFetchError("TOO_MANY_REDIRECTS");
      let next: URL;
      try {
        next = new URL(res.location, url);
      } catch {
        throw new SafeFetchError("BLOCKED_REDIRECT");
      }
      // Too long isn't a safety matter, so it is reported as the site being unreadable.
      if (next.href.length > MAX_REDIRECT_URL_CHARS) throw new SafeFetchError("REDIRECT_TOO_LONG");
      try {
        url = validate(next.href, MAX_REDIRECT_URL_CHARS);
      } catch (err) {
        // A redirect aimed at somewhere we refuse is itself the finding: say so.
        if (err instanceof SafeFetchError) throw new SafeFetchError("BLOCKED_REDIRECT", err.code);
        throw err;
      }
    }
  };
}

/** The production fetcher. Takes no overrides. */
export const safeFetch: SafeFetch = createSafeFetcher();
