/**
 * Sitemap with database data: a project's and a DB post's updatedAt become <lastmod> as they are; rows without
 * a date have none. The DAL and blog loaders are replaced, so no database is needed.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

const PROJECT_EDITED = new Date("2026-10-01T10:15:00.000Z");
mock.module("@/lib/dal", {
  namedExports: {
    getSitemapProjects: async () => [
      { slug: "riad-edited", lastModified: PROJECT_EDITED },
      { slug: "fallback-like", lastModified: null },
    ],
  },
});
mock.module("@/lib/blog", {
  namedExports: {
    getAllPosts: async (locale: string) => {
      assert.equal(locale, "fr");
      return [
        { slug: "db-post", lastModified: "2026-09-12T08:00:00.000Z" },
        { slug: "mdx-post", lastModified: "2026-05-20" },
        { slug: "undated-post", lastModified: undefined },
      ];
    },
  },
});

test("project and post change dates are used as they are; missing ones are omitted", async () => {
  const { default: sitemap } = await import("../src/app/sitemap");
  const entries = await sitemap();
  const lastmod = (path: string) => entries.find((e) => e.url.endsWith(`/fr${path}`))?.lastModified;
  assert.equal(lastmod("/portfolio/riad-edited"), PROJECT_EDITED);
  assert.equal(lastmod("/blog/db-post"), "2026-09-12T08:00:00.000Z");
  assert.equal(lastmod("/blog/mdx-post"), "2026-05-20");
  for (const path of ["/portfolio/fallback-like", "/blog/undated-post", "", "/services", "/contact"]) {
    const e = entries.find((x) => x.url.endsWith(`/fr${path}`));
    assert.ok(e, path);
    assert.equal("lastModified" in e, false, `${path}: no lastmod`);
  }
});
