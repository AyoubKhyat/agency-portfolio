/**
 * The SSRF rules. Local test sites only: a loopback server plus an injected resolver, so these tests
 * touch no external network. The production fetcher is never loosened: `allow` below exists only here.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { gzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { readdirSync, readFileSync, statSync } from "node:fs";
import {
  createSafeFetcher, isPublicAddress, safeFetch, SafeFetchError, MAX_REDIRECTS, MAX_REDIRECT_URL_CHARS, SSRF_CODES, type SafeFetcherConfig,
} from "../src/lib/website-audit/safe-fetch";

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "NO_ERROR";
  } catch (e) {
    assert.ok(e instanceof SafeFetchError, `unexpected error: ${e}`);
    return e.code;
  }
};

let server: http.Server;
let port = 0;
const requests: { url: string; headers: http.IncomingHttpHeaders }[] = [];

before(async () => {
  server = http.createServer((req, res) => {
    requests.push({ url: req.url ?? "", headers: req.headers });
    const html = (body: string) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(body); };
    switch (req.url) {
      case "/ok": return html("<title>Local site</title>");
      case "/to-ok": res.writeHead(302, { location: "/ok" }); return res.end();
      case "/loop": res.writeHead(302, { location: "/loop" }); return res.end();
      case "/two-more": res.writeHead(302, { location: "/one-more" }); return res.end();
      case "/one-more": res.writeHead(302, { location: "/to-ok" }); return res.end();
      case "/to-private": res.writeHead(302, { location: "http://internal.site.example/" }); return res.end();
      case "/to-file": res.writeHead(302, { location: "file:///etc/passwd" }); return res.end();
      case "/to-port": res.writeHead(302, { location: `http://site.example:22/` }); return res.end();
      case "/to-long": res.writeHead(302, { location: `/ok?token=${"a".repeat(600)}` }); return res.end();
      case "/to-too-long": res.writeHead(302, { location: `/ok?token=${"a".repeat(MAX_REDIRECT_URL_CHARS)}` }); return res.end();
      case "/to-private-long": res.writeHead(302, { location: `http://internal.site.example/?token=${"a".repeat(600)}` }); return res.end();
      case "/gz-sitemap": res.writeHead(200, { "content-type": "application/gzip" }); return res.end(gzipSync("<urlset/>"));
      case "/xml-sitemap": res.writeHead(200, { "content-type": "application/xml; charset=utf-8" }); return res.end("<urlset/>");
      case "/pdf": res.writeHead(200, { "content-type": "application/pdf" }); return res.end("%PDF");
      case "/none": res.writeHead(200); return res.end("x");
      case "/huge": res.writeHead(200, { "content-type": "text/html" }); return res.end("a".repeat(5_000_000));
      case "/bomb": res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" }); return res.end(gzipSync(Buffer.alloc(20_000_000, "a")));
      case "/gzip": res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip" }); return res.end(gzipSync("<title>Zipped</title>"));
      case "/slow": res.writeHead(200, { "content-type": "text/html" }); res.write("<title>"); return; // never finishes
      case "/stall": return; // never answers
      default: res.writeHead(404, { "content-type": "text/html" }); return res.end("nope");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});
after(() => { server.closeAllConnections(); server.close(); });

/** The only thing loosened is what a test site needs: its port, and loopback for this one name. */
const allow = (over: Partial<SafeFetcherConfig> = {}) => createSafeFetcher({
  allowedPorts: [80, 443, port],
  resolve: async (host) => {
    if (host === "site.example") return [{ address: "127.0.0.1", family: 4 }];
    if (host === "internal.site.example") return [{ address: "10.0.0.5", family: 4 }];
    if (host === "mixed.example") return [{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }];
    throw new Error("ENOTFOUND");
  },
  isAllowedHostname: () => true,
  isAllowedAddress: (a) => a === "127.0.0.1",
  ...over,
});
const site = (path: string) => `http://site.example:${port}${path}`;

test("the address rules block everything not on the public internet", () => {
  for (const ip of [
    "0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "127.8.8.8", "169.254.169.254", "172.16.0.1", "172.31.255.255",
    "192.0.0.1", "192.0.2.1", "192.168.1.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "240.0.0.1", "255.255.255.255",
    "::", "::1", "fc00::1", "fd12::1", "fe80::1", "ff02::1", "2001:db8::1", "2002:7f00:1::", "2001::1", "64:ff9b::7f00:1",
    "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:169.254.169.254", "not-an-ip", "",
  ]) assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ["93.184.216.34", "1.1.1.1", "8.8.8.8", "172.15.0.1", "172.32.0.1", "2606:4700:4700::1111", "2a00:1450:4001::1"]) {
    assert.equal(isPublicAddress(ip), true, ip);
  }
});

test("the real fetcher refuses unsafe addresses before making any connection", async () => {
  const cases: [string, string][] = [
    ["http://localhost/", "INVALID_URL"], // no dot, so it isn't a public site at all
    ["http://127.0.0.1/", "INVALID_URL"],
    ["http://2130706433/", "INVALID_URL"], // decimal form of 127.0.0.1
    ["http://0x7f.0.0.1/", "INVALID_URL"],
    ["http://[::1]/", "INVALID_URL"],
    ["http://169.254.169.254/latest/meta-data/", "INVALID_URL"],
    ["ftp://example.com/", "INVALID_URL"],
    ["file:///etc/passwd", "INVALID_URL"],
    ["http://user:pass@example.com/", "INVALID_URL"],
    ["http://app.localhost/", "BLOCKED_HOST"],
    ["http://db.internal/", "BLOCKED_HOST"],
    ["http://printer.local/", "BLOCKED_HOST"],
    ["http://metadata.google.internal/", "BLOCKED_HOST"],
    ["http://example.com:22/", "BLOCKED_PORT"],
    ["http://example.com:6379/", "BLOCKED_PORT"],
    ["https://example.com:8443/", "BLOCKED_PORT"],
  ];
  for (const [url, expected] of cases) assert.equal(await code(safeFetch(url, { kind: "html" })), expected, url);
});

test("a name resolving to a private address never connects, even if only one answer is private", async () => {
  const before = requests.length;
  const strict = allow({ isAllowedAddress: isPublicAddress });
  assert.equal(await code(strict(site("/ok"), { kind: "html" })), "BLOCKED_ADDRESS");
  const mixed = allow({ isAllowedAddress: isPublicAddress });
  assert.equal(await code(mixed(`http://mixed.example:${port}/ok`, { kind: "html" })), "BLOCKED_ADDRESS");
  assert.equal(requests.length, before, "the server must not have been reached");
});

test("DNS rebinding: the address checked is the address connected to, on every connection", async () => {
  let lookups = 0;
  const rebinding = allow({
    resolve: async () => {
      lookups++;
      return [{ address: lookups === 1 ? "127.0.0.1" : "10.0.0.5", family: 4 }];
    },
  });
  const before = requests.length;
  // /to-ok redirects to the same name: the second connection resolves again and gets the private answer.
  assert.equal(await code(rebinding(site("/to-ok"), { kind: "html" })), "BLOCKED_ADDRESS");
  assert.equal(lookups, 2);
  assert.equal(requests.length, before + 1, "only the first, checked connection reached the server");
});

test("redirects are followed by hand, each hop checked, with a limit", async () => {
  const f = allow();
  const ok = await f(site("/to-ok"), { kind: "html" });
  assert.equal(ok.status, 200);
  assert.equal(new URL(ok.finalUrl).pathname, "/ok");
  assert.equal(ok.hops.length, 2);

  assert.equal(await code(f(site("/loop"), { kind: "html" })), "TOO_MANY_REDIRECTS");
  assert.equal(await code(allow()(site("/to-private"), { kind: "html" })), "BLOCKED_ADDRESS");
  assert.equal(await code(f(site("/to-file"), { kind: "html" })), "BLOCKED_REDIRECT");
  assert.equal(await code(f(site("/to-port"), { kind: "html" })), "BLOCKED_REDIRECT");
  assert.equal((await f(site("/two-more"), { kind: "html" })).hops.length, MAX_REDIRECTS + 1, "exactly the limit is allowed");

  const held = await f(site("/to-ok"), { kind: "html", followRedirects: false });
  assert.equal(held.status, 302);
  assert.equal(held.headers.location, "/ok");
});

test("a long redirect is followed, and one too long is unreadable rather than a safety alarm", async () => {
  // These query strings would hit the 300-character limit on typed addresses, but they aren't typed by anyone.
  const long = await allow()(site("/to-long"), { kind: "html" }).catch((e) => e);
  assert.equal(long.code, undefined, "followed");
  assert.equal(long.status, 404, "this test site only serves /ok without a query");
  const tooLong = await code(allow()(site("/to-too-long"), { kind: "html" }));
  assert.equal(tooLong, "REDIRECT_TOO_LONG");
  assert.ok(!SSRF_CODES.includes(tooLong as never), "not reported as blocked for safety");
  assert.equal(await code(allow()(site("/to-private-long"), { kind: "html" })), "BLOCKED_ADDRESS", "every hop is still checked, however long");
});

test("sitemaps can be compressed files, but an HTML page is not one", async () => {
  const f = allow();
  assert.equal((await f(site("/gz-sitemap"), { kind: "sitemap" })).status, 200);
  assert.equal((await f(site("/xml-sitemap"), { kind: "sitemap" })).status, 200);
  assert.equal(await code(f(site("/ok"), { kind: "sitemap" })), "BAD_CONTENT_TYPE");
  assert.equal(await code(f(site("/pdf"), { kind: "sitemap" })), "BAD_CONTENT_TYPE");
  assert.equal(await code(f(site("/gz-sitemap"), { kind: "text" })), "BAD_CONTENT_TYPE", "other reads stay strict");
});

test("only the expected content types are read", async () => {
  const f = allow();
  assert.equal(await code(f(site("/pdf"), { kind: "html" })), "BAD_CONTENT_TYPE");
  assert.equal(await code(f(site("/none"), { kind: "html" })), "BAD_CONTENT_TYPE");
  assert.equal(await code(f(site("/ok"), { kind: "text" })), "BAD_CONTENT_TYPE");
  assert.equal((await f(site("/missing"), { kind: "html" })).status, 404, "an error status needs no content check");
});

test("size is capped, after decompression, and reading stops there", async () => {
  const f = allow({ maxBodyBytes: 100_000 });
  const huge = await f(site("/huge"), { kind: "html" });
  assert.equal(huge.truncated, true);
  assert.equal(huge.bytes, 100_000);
  const bomb = await f(site("/bomb"), { kind: "html" });
  assert.equal(bomb.truncated, true);
  assert.equal(bomb.bytes, 100_000);
  const zipped = await f(site("/gzip"), { kind: "html" });
  assert.equal(zipped.body, "<title>Zipped</title>");
  assert.equal(zipped.truncated, false);
});

test("stopping at the size limit stops the decompressor too", () => {
  const src = readFileSync(new URL("../src/lib/website-audit/safe-fetch.ts", import.meta.url), "utf8");
  assert.match(src, /if \(stream !== res\) stream\.destroy\(\);/);
});

test("time is capped, including a response that starts and never finishes", async () => {
  const f = allow({ hopTimeoutMs: 150 });
  assert.equal(await code(f(site("/stall"), { kind: "html" })), "TIMEOUT");
  assert.equal(await code(f(site("/slow"), { kind: "html" })), "TIMEOUT");
  assert.equal(await code(allow()(site("/ok"), { kind: "html", deadlineAt: Date.now() - 1 })), "TIMEOUT");
});

test("requests carry no cookies or credentials and identify the tool", async () => {
  await allow()(site("/ok"), { kind: "html" });
  const { headers } = requests[requests.length - 1];
  assert.equal(headers.cookie, undefined);
  assert.equal(headers.authorization, undefined);
  assert.match(headers["user-agent"] ?? "", /^Ibda3AuditBot\//);
  assert.equal(headers.connection, "close");
});

test("failures are reported, not thrown as something else", async () => {
  assert.equal(await code(allow()(`http://unknown.example:${port}/`, { kind: "html" })), "DNS_FAILED");
  const closed = allow({ resolve: async () => [{ address: "127.0.0.1", family: 4 }], allowedPorts: [1] });
  assert.equal(await code(closed("http://site.example:1/", { kind: "html" })), "NETWORK_ERROR");
});

test("nothing outside the tests loosens the fetcher, and verify.ts is untouched by this work", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = `${dir}/${n}`;
    return statSync(p).isDirectory() ? (n === "generated" ? [] : walk(p)) : /\.tsx?$/.test(n) ? [p] : [];
  });
  const root = new URL("../src", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
  for (const file of walk(root)) {
    if (file.endsWith("website-audit/safe-fetch.ts")) continue;
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, /createSafeFetcher/, `${file} must use the production safeFetch`);
  }
  const fetcherSrc = readFileSync(new URL("../src/lib/website-audit/safe-fetch.ts", import.meta.url), "utf8");
  assert.match(fetcherSrc, /export const safeFetch: SafeFetch = createSafeFetcher\(\);/, "production fetcher takes no overrides");
  assert.doesNotMatch(readFileSync(new URL("../src/lib/discovery/verify.ts", import.meta.url), "utf8"), /safe-fetch/);
});
