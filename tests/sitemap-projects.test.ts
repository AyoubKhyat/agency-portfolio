/**
 * getSitemapProjects(): visible projects with their updatedAt, and the fallback list (no dates) when there is no
 * database, the query fails, or no project is visible. Prisma is replaced, so no database is needed.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

let state: { has: boolean; rows?: { slug: string; updatedAt: Date }[]; error?: Error } = { has: false };
let lastQuery: unknown = null;
mock.module("../src/lib/prisma", {
  namedExports: {
    hasPrisma: () => state.has,
    prisma: {
      project: {
        findMany: async (q: unknown) => {
          lastQuery = q;
          if (state.error) throw state.error;
          return state.rows ?? [];
        },
      },
    },
  },
});

test("database rows: visible projects only, in order, with their updatedAt; fallback otherwise", async () => {
  const { getSitemapProjects, getAllProjectSlugs } = await import("../src/lib/dal/projects");
  const { FALLBACK_SLUGS } = await import("../src/lib/fallback-projects");
  const fallback = FALLBACK_SLUGS.map((slug) => ({ slug, lastModified: null }));

  state = { has: false };
  assert.deepEqual(await getSitemapProjects(), fallback, "no database: the fallback list, without dates");

  const edited = new Date("2026-10-01T10:15:00Z");
  state = { has: true, rows: [{ slug: "riad-a", updatedAt: edited }, { slug: "riad-b", updatedAt: new Date("2026-09-01T00:00:00Z") }] };
  assert.deepEqual(await getSitemapProjects(), [{ slug: "riad-a", lastModified: edited }, { slug: "riad-b", lastModified: new Date("2026-09-01T00:00:00Z") }]);
  assert.deepEqual(lastQuery, { where: { visible: true }, select: { slug: true, updatedAt: true }, orderBy: { sortOrder: "asc" } }, "hidden projects stay out");
  assert.deepEqual(await getAllProjectSlugs(), ["riad-a", "riad-b"], "the slug list is unchanged");

  state = { has: true, rows: [] };
  assert.deepEqual(await getSitemapProjects(), fallback, "no visible project: the fallback list");

  state = { has: true, error: new Error("connection refused") };
  assert.deepEqual(await getSitemapProjects(), fallback, "a failing query never breaks the sitemap");
});
