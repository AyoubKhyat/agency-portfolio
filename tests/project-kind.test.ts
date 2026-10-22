/**
 * Client / Concept classification (Project.kind).
 *
 * Replaces the hardcoded CLIENT_SLUGS allowlist, which once listed "dandana"
 * while the real slug was "dandana-cabaret" (shown as a concept, 2026-10-22).
 * The DAL runs against a fake Prisma client, so no database is touched.
 * Needs --experimental-test-module-mocks (see the "test" script).
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROJECT_KIND, PROJECT_KINDS, isClientProject, isProjectKind } from "../src/lib/project-kind";
import { FALLBACK_PROJECTS } from "../src/lib/fallback-projects";

type Call = { op: string; args: Record<string, unknown> };
const fake = { available: true, calls: [] as Call[], rows: [] as Record<string, unknown>[] };

mock.module("../src/lib/prisma", {
  namedExports: {
    hasPrisma: () => fake.available,
    prisma: {
      project: {
        aggregate: async () => ({ _max: { sortOrder: 8 } }),
        create: async (args: Record<string, unknown>) => { fake.calls.push({ op: "create", args }); return { id: "new" }; },
        update: async (args: Record<string, unknown>) => { fake.calls.push({ op: "update", args }); return { id: "p1" }; },
        findMany: async (args: Record<string, unknown>) => { fake.calls.push({ op: "findMany", args }); return fake.rows; },
      },
      projectTranslation: { deleteMany: async () => ({ count: 3 }) },
      $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    },
  },
});
// Fallback mode reads translations; without a Next request we take its untranslated branch.
mock.module("next-intl/server", {
  namedExports: { getTranslations: async () => { throw new Error("no request context"); } },
});

const dal = import("../src/lib/dal");
const input = (kind?: string) => ({
  slug: "x", category: "web", url: "", image: "", tag: "", status: "PUBLISHED",
  ...(kind === undefined ? {} : { kind }),
  translations: [{ locale: "fr", title: "X", desc: "", tags: "" }],
});
const lastData = (op: string) =>
  (fake.calls.filter((c) => c.op === op).at(-1)?.args.data ?? {}) as Record<string, unknown>;

test("helpers: only CLIENT and CONCEPT are valid; default is CONCEPT", () => {
  assert.deepEqual([...PROJECT_KINDS], ["CLIENT", "CONCEPT"]);
  assert.equal(DEFAULT_PROJECT_KIND, "CONCEPT");
  for (const ok of ["CLIENT", "CONCEPT"]) assert.equal(isProjectKind(ok), true);
  for (const bad of ["client", "Concept", "", "PARTNER", null, undefined, 1]) assert.equal(isProjectKind(bad), false);
});

test("isClientProject: only an explicit CLIENT counts; unknown is never client", () => {
  assert.equal(isClientProject({ kind: "CLIENT" }), true);
  for (const kind of ["CONCEPT", "client", "", null, undefined]) assert.equal(isClientProject({ kind }), false);
  assert.equal(isClientProject({}), false);
});

test("fallback data (no database) keeps the production classification", () => {
  const kinds = Object.fromEntries(FALLBACK_PROJECTS.map((p) => [p.slug, p.kind]));
  assert.deepEqual(kinds, {
    "hammam-nour": "CONCEPT", goudoukh: "CONCEPT", tannour: "CONCEPT", terrene: "CLIENT",
    "victory-path": "CONCEPT", "aylani-parfums": "CLIENT", "luxury-copro": "CLIENT", "asrar-lalla": "CONCEPT",
  });
});

test("createProject defaults to CONCEPT and saves an explicit kind", async () => {
  const { createProject } = await dal;
  fake.available = true;
  await createProject(input());
  assert.equal(lastData("create").kind, "CONCEPT");
  await createProject(input("CLIENT"));
  assert.equal(lastData("create").kind, "CLIENT");
});

test("updateProject keeps the saved kind when omitted, changes it when given", async () => {
  const { updateProject } = await dal;
  fake.available = true;
  await updateProject("p1", input());
  assert.equal("kind" in lastData("update"), false, "omitted kind must not be written");
  await updateProject("p1", input("CONCEPT"));
  assert.equal(lastData("update").kind, "CONCEPT");
  await updateProject("p1", input("CLIENT"));
  assert.equal(lastData("update").kind, "CLIENT");
});

test("portfolio and homepage queries select kind and pass it through", async () => {
  const { getPortfolioProjects, getHomepageProjects } = await dal;
  fake.available = true;
  fake.rows = [
    { slug: "dandana-cabaret", url: "u", image: "/i.webp", tag: "Restaurant", kind: "CLIENT", translations: [{ title: "Dandana Cabaret", desc: "", tags: "", industry: "" }] },
    { slug: "tannour", url: "u", image: "/t.webp", tag: "E-commerce", kind: "CONCEPT", translations: [{ title: "Tannour", desc: "", tags: "", industry: "" }] },
  ];
  for (const [fn, name] of [[getPortfolioProjects, "portfolio"], [getHomepageProjects, "homepage"]] as const) {
    const projects = await fn("fr");
    const select = (fake.calls.filter((c) => c.op === "findMany").at(-1)?.args.select ?? {}) as Record<string, unknown>;
    assert.equal(select.kind, true, `${name} query selects kind`);
    assert.deepEqual(projects.map((p) => [p.slug, p.kind, isClientProject(p)]), [
      ["dandana-cabaret", "CLIENT", true],
      ["tannour", "CONCEPT", false],
    ], name);
  }
});

test("without a database, the fallback lists still carry kind", async () => {
  const { getPortfolioProjects, getHomepageProjects } = await dal;
  fake.available = false;
  for (const fn of [getPortfolioProjects, getHomepageProjects]) {
    const projects = await fn("fr");
    assert.ok(projects.length > 0);
    assert.deepEqual(
      projects.filter(isClientProject).map((p) => p.slug).sort(),
      ["aylani-parfums", "luxury-copro", "terrene"].filter((s) => projects.some((p) => p.slug === s)).sort(),
    );
  }
  fake.available = true;
});
