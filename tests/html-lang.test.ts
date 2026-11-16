/**
 * The server-rendered <html lang dir> must match the URL's locale before any JavaScript runs:
 *   /fr… → lang="fr" dir="ltr" · /en… → lang="en" dir="ltr" · /ar… → lang="ar" dir="rtl".
 *
 * Root cause guarded here: the proxy matcher was written "\." in a plain JS string, so it compiled to ".*..*" and
 * the proxy only ran on "/". next-intl never set its X-NEXT-INTL-LOCALE header for locale pages, and the root
 * layout's getLocale() fell back to "fr" for every page.
 *
 * Unit part: always runs (Next's own matcher compiler, routing config, root layout).
 * Live part: runs when HTML_LANG_BASE_URL points at a running build (e.g. `npm run build && npx next start`),
 * and reads the raw HTML as a crawler or a first paint sees it, with no JavaScript.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Next's own matcher compiler (the one the build uses); it exists at runtime but isn't in Next's type declarations.
const { getMiddlewareMatchers } = createRequire(import.meta.url)("next/dist/build/analysis/get-page-static-info") as {
  getMiddlewareMatchers: (matcher: string | string[], nextConfig: Record<string, unknown>) => { regexp: string }[];
};

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("the proxy runs on every locale page, and not on files, the API, signing pages or Next's own assets", async () => {
  const { config } = await import("../src/proxy");
  const regexps = getMiddlewareMatchers(config.matcher, {}).map((m) => new RegExp(m.regexp));
  const runs = (path: string) => regexps.some((re) => re.test(path));
  for (const path of ["/", "/fr", "/en", "/ar", "/fr/services", "/en/services/web", "/ar/blog/pourquoi-site-web-2026", "/en/portfolio/tannour", "/admin", "/admin/login"]) {
    assert.equal(runs(path), true, `runs on ${path}`);
  }
  for (const path of ["/logo.png", "/favicon.ico", "/sitemap.xml", "/robots.txt", "/api/contact", "/api/admin/login", "/sign/abc", "/_next/static/chunks/a.js", "/_vercel/insights/script.js"]) {
    assert.equal(runs(path), false, `skips ${path}`);
  }
  assert.match(config.matcher[1], /\.\*\\\.\.\*/, 'the dot stays escaped at runtime (".*\\..*", not ".*..*")');
});

test("the middleware adds no second hreflang set: the pages' own tags are the only ones", async () => {
  const { routing } = await import("../src/i18n/routing");
  assert.equal(routing.alternateLinks, false);
  assert.deepEqual([...routing.locales], ["fr", "en", "ar"]);
  assert.equal(routing.defaultLocale, "fr");
});

test("the root layout sets lang and dir from the request locale", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /const locale = await getLocale\(\);/);
  assert.match(layout, /lang=\{locale\}/);
  assert.match(layout, /dir=\{locale === "ar" \? "rtl" : "ltr"\}/);
});

/* ── live HTML (before JavaScript) ── */

const BASE = process.env.HTML_LANG_BASE_URL?.replace(/\/$/, "") ?? "";
const live = BASE ? false : "set HTML_LANG_BASE_URL to a running build to check the served HTML";
const EXPECTED = { fr: "ltr", en: "ltr", ar: "rtl" } as const;
const PAGES = ["", "/services", "/services/web", "/portfolio", "/blog", "/blog/pourquoi-site-web-2026", "/about", "/contact"];

async function fetchPage(path: string, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} });
  const html = await res.text();
  const tag = /<html\b[^>]*>/i.exec(html)?.[0] ?? "";
  const head = html.split("</head>")[0];
  return {
    res, html,
    lang: /\blang="([^"]*)"/.exec(tag)?.[1], dir: /\bdir="([^"]*)"/.exec(tag)?.[1],
    canonical: /<link rel="canonical" href="([^"]+)"/.exec(head)?.[1],
    hreflang: Object.fromEntries([...head.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]])),
    setCookie: res.headers.get("set-cookie") ?? "",
  };
}

test("direct navigation: each locale's pages are served with their own lang and dir", { skip: live }, async () => {
  for (const [locale, dir] of Object.entries(EXPECTED)) {
    for (const page of PAGES) {
      const p = await fetchPage(`/${locale}${page}`);
      assert.equal(p.res.status, 200, `/${locale}${page}`);
      assert.equal(p.lang, locale, `lang on /${locale}${page}`);
      assert.equal(p.dir, dir, `dir on /${locale}${page}`);
    }
  }
});

test("refresh: the same page again, with the cookies it set, or with another locale's cookie, keeps the URL's locale", { skip: live }, async () => {
  for (const [locale, dir] of Object.entries(EXPECTED)) {
    const first = await fetchPage(`/${locale}/services`);
    const cookie = first.setCookie.split(";")[0];
    assert.equal(cookie, `NEXT_LOCALE=${locale}`, "the visitor's language is remembered");
    for (const c of [cookie, ...Object.keys(EXPECTED).filter((l) => l !== locale).map((l) => `NEXT_LOCALE=${l}`)]) {
      const again = await fetchPage(`/${locale}/services`, c);
      assert.equal(again.res.status, 200);
      assert.equal(again.lang, locale, `refresh /${locale}/services with ${c}`);
      assert.equal(again.dir, dir);
    }
  }
});

test("canonical, hreflang, redirects and protected routes are unchanged", { skip: live }, async () => {
  for (const locale of Object.keys(EXPECTED)) {
    const p = await fetchPage(`/${locale}/services`);
    assert.match(p.canonical ?? "", new RegExp(`/${locale}/services$`), "self canonical");
    assert.deepEqual(Object.keys(p.hreflang).sort(), ["ar", "en", "fr", "x-default"]);
    assert.match(p.hreflang["x-default"], /\/fr\/services$/, "x-default stays the French page");
    assert.doesNotMatch(p.res.headers.get("link") ?? "", /hreflang/i, "no second hreflang set in a Link header");
  }
  const root = await fetch(`${BASE}/`, { redirect: "manual", headers: { "accept-language": "fr" } });
  assert.equal(root.status, 307);
  assert.match(root.headers.get("location") ?? "", /\/fr$/);
  const admin = await fetch(`${BASE}/admin`, { redirect: "manual" });
  assert.equal(admin.status, 307);
  assert.match(admin.headers.get("location") ?? "", /\/admin\/login$/);
  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
    assert.equal(r.status, 200, path);
    assert.equal(r.headers.get("set-cookie"), null, `the proxy doesn't run on ${path}`);
  }
});
