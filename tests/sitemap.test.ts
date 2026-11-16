/**
 * Sitemap: same URLs, alternates and exclusions as before, and <lastmod> only from real change dates.
 * No database here (DATABASE_URL unset): the fallback project list and the MDX posts. The database path, with
 * project and post updatedAt, is in sitemap-db.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import matter from "gray-matter";

delete process.env.DATABASE_URL;
const sitemapModule = () => import("../src/app/sitemap");
// Next's own sitemap.xml serializer (internal, not in its type declarations).
const { resolveSitemap } = createRequire(import.meta.url)("next/dist/build/webpack/loaders/metadata/resolve-route-data") as {
  resolveSitemap: (data: unknown) => string;
};

test("the same URLs as before: pages, service pages, projects and posts, on the canonical domain", async () => {
  const { default: sitemap } = await sitemapModule();
  const { SITE_URL } = await import("../src/lib/site");
  const { DETAIL_PAGE_IDS } = await import("../src/lib/services-catalog");
  const { FALLBACK_SLUGS } = await import("../src/lib/fallback-projects");
  const posts = readdirSync("content/blog/fr").map((f) => matter(readFileSync(`content/blog/fr/${f}`, "utf8")).data.slug as string);
  const entries = await sitemap();
  const paths = entries.map((e) => e.url.replace(`${SITE_URL}/fr`, ""));
  const expected = ["", "/services", "/portfolio", "/blog", "/about", "/contact",
    ...DETAIL_PAGE_IDS.map((s) => `/services/${s}`), ...FALLBACK_SLUGS.map((s) => `/portfolio/${s}`), ...posts.map((s) => `/blog/${s}`)];
  assert.deepEqual([...paths].sort(), [...expected].sort());
  assert.equal(SITE_URL, "https://www.ibda3digital.com");
  for (const e of entries) {
    assert.ok(e.url.startsWith(`${SITE_URL}/fr`), e.url);
    const path = e.url.slice(`${SITE_URL}/fr`.length);
    assert.deepEqual(e.alternates?.languages, {
      "x-default": `${SITE_URL}/fr${path}`, fr: `${SITE_URL}/fr${path}`, en: `${SITE_URL}/en${path}`, ar: `${SITE_URL}/ar${path}`,
    });
    assert.doesNotMatch(e.url, /\/(admin|api|sign|privacy|sectors|uploads)(\/|$)/, "excluded pages stay out");
  }
});

test("lastmod: only real dates; never the time of the request", async () => {
  const { default: sitemap } = await sitemapModule();
  const first = await sitemap();
  await new Promise((r) => setTimeout(r, 25));
  const second = await sitemap();
  assert.deepEqual(second, first, "two requests give the same sitemap");

  const byPath = new Map(first.map((e) => [new URL(e.url).pathname.replace(/^\/fr/, "") || "/", e]));
  for (const [path, e] of byPath) {
    if (!path.startsWith("/blog/")) assert.equal("lastModified" in e, false, `${path}: no real date, so no lastmod`);
  }
  for (const f of readdirSync("content/blog/fr")) {
    const { data } = matter(readFileSync(`content/blog/fr/${f}`, "utf8"));
    assert.equal(byPath.get(`/blog/${data.slug}`)?.lastModified, data.date, `${data.slug}: the post's own date`);
  }
  const xml = resolveSitemap(first);
  assert.equal((xml.match(/<url>/g) ?? []).length, first.length);
  assert.equal((xml.match(/<lastmod>/g) ?? []).length, first.filter((e) => e.lastModified).length);
  assert.ok(!xml.includes(`<lastmod>${new Date().toISOString().slice(0, 10)}`), "no entry claims it changed today");
});

test("content dates: real past calendar days only", async () => {
  const { validContentDate } = await import("../src/lib/blog");
  assert.equal(validContentDate("2026-05-20"), "2026-05-20");
  assert.equal(validContentDate(" 2026-05-20 "), "2026-05-20");
  assert.equal(validContentDate(new Date("2026-05-20T00:00:00Z")), "2026-05-20", "an unquoted YAML date");
  for (const bad of ["", "2026-02-30", "20/05/2026", "2026-5-2", "soon", "2999-01-01", new Date("x"), null, undefined, 20260520]) {
    assert.equal(validContentDate(bad), undefined, String(bad));
  }
});

test("the sitemap never stamps the current time", () => {
  const src = readFileSync("src/app/sitemap.ts", "utf8").replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
  assert.doesNotMatch(src, /new Date\(|Date\.now\(/);
});
