/**
 * Route-level checks for duplicate slugs on POST /api/admin/projects and
 * PUT /api/admin/projects/[id]. Auth, data access and audit are mocked, so
 * no database is touched. Needs --experimental-test-module-mocks (see the
 * "test" script).
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

type Row = { id: string; slug: string };
const db = { rows: [] as Row[], createError: null as unknown, updateError: null as unknown, writes: 0 };

function reset(rows: Row[]) {
  db.rows = rows;
  db.createError = null;
  db.updateError = null;
  db.writes = 0;
}

mock.module("@/lib/auth", {
  namedExports: {
    getSession: async () => ({ userId: "u1", email: "a@b.c", fullName: "Test", role: "admin", avatarInitials: "T" }),
  },
});
mock.module("@/lib/audit", {
  namedExports: { logAudit: async () => {}, getClientIp: () => "127.0.0.1" },
});
mock.module("@/lib/dal", {
  namedExports: {
    getProjectsForAdmin: async () => db.rows,
    getProjectByIdForAdmin: async (id: string) => db.rows.find((r) => r.id === id) ?? null,
    getProjectIdBySlug: async (slug: string) => db.rows.find((r) => r.slug === slug)?.id ?? null,
    createProject: async (data: { slug: string }) => {
      if (db.createError) throw db.createError;
      db.writes++;
      const row = { id: `new-${db.writes}`, slug: data.slug };
      db.rows.push(row);
      return row;
    },
    updateProject: async (id: string, data: { slug: string }) => {
      if (db.updateError) throw db.updateError;
      db.writes++;
      return { id, slug: data.slug };
    },
    deleteProject: async () => {},
    toggleProjectVisibility: async () => {},
  },
});

// Imported after the mocks are registered, so the routes bind to them.
const routes = Promise.all([
  import("../src/app/api/admin/projects/route"),
  import("../src/app/api/admin/projects/[id]/route"),
]);

const translation = { locale: "fr", title: "Dandana Cabaret", desc: "Restaurant cabaret" };
const createBody = (slug: string) => ({ slug, category: "web", url: "https://dandanacabaret.com/", tag: "Restaurant", translations: [translation] });
const post = async (body: unknown) =>
  (await routes)[0].POST(new Request("http://x/api/admin/projects", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));
const put = async (id: string, body: unknown) =>
  (await routes)[1].PUT(new Request(`http://x/api/admin/projects/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

const neonSlugP2002 = {
  code: "P2002",
  message: "Invalid `prisma.project.create()` invocation: postgres://user:secret@host/db Unique constraint failed",
  meta: { modelName: "Project", driverAdapterError: { cause: { kind: "UniqueConstraintViolation", constraint: { fields: ["slug"] } } } },
};

test("POST with a new slug creates the project (201)", async () => {
  reset([]);
  const res = await post(createBody("dandana-cabaret"));
  assert.equal(res.status, 201);
  assert.equal(db.writes, 1);
});

test("POST with an existing slug is 409 and writes nothing", async () => {
  reset([{ id: "cmvjfyp21000008jsr6n1kzzc", slug: "dandana-cabaret" }]);
  const res = await post(createBody("dandana-cabaret"));
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /"dandana-cabaret" already exists/);
  assert.equal(db.writes, 0);
});

test("POST race: P2002 from the unique index is still a 409", async () => {
  reset([]);
  db.createError = neonSlugP2002;
  const res = await post(createBody("dandana-cabaret"));
  assert.equal(res.status, 409);
});

test("POST unexpected error is a safe JSON 500 (no Prisma details)", async () => {
  reset([]);
  db.createError = new Error("connect ECONNREFUSED postgres://user:secret@host/db");
  const res = await post(createBody("x-project"));
  assert.equal(res.status, 500);
  const { error } = await res.json();
  assert.equal(error, "Could not create the project. Please try again.");
});

test("POST with a malformed JSON body is 400", async () => {
  reset([]);
  assert.equal((await post("{not json")).status, 400);
});

test("PUT keeping its own slug succeeds", async () => {
  reset([{ id: "p1", slug: "dandana-cabaret" }]);
  const res = await put("p1", { slug: "dandana-cabaret", category: "web", translations: [translation] });
  assert.equal(res.status, 200);
  assert.equal(db.writes, 1);
});

test("PUT onto another project's slug is 409 and writes nothing", async () => {
  reset([{ id: "p1", slug: "dandana-cabaret" }, { id: "p2", slug: "tannour" }]);
  const res = await put("p2", { slug: "dandana-cabaret", category: "web", translations: [translation] });
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /"dandana-cabaret" already exists/);
  assert.equal(db.writes, 0);
});

test("PUT race: P2002 on slug is 409", async () => {
  reset([{ id: "p2", slug: "tannour" }]);
  db.updateError = neonSlugP2002;
  assert.equal((await put("p2", { slug: "dandana-cabaret", category: "web", translations: [translation] })).status, 409);
});

test("PUT unexpected error no longer leaks the Prisma message", async () => {
  reset([{ id: "p1", slug: "dandana-cabaret" }]);
  db.updateError = new Error("Invalid `prisma.project.update()` postgres://user:secret@host/db");
  const res = await put("p1", { slug: "dandana-cabaret", category: "web", translations: [translation] });
  assert.equal(res.status, 500);
  const { error } = await res.json();
  assert.equal(error, "Could not save the project. Please try again.");
  assert.doesNotMatch(error, /secret|prisma|postgres/i);
});
