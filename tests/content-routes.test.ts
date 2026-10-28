/**
 * /api/admin/content and /api/admin/content/[id]: access, validation, the Published guard,
 * concurrent-edit protection and auditing — with the session, the audit log and Prisma mocked
 * (an in-memory table; no database). Real SQL is covered by tests/content-db.test.ts against an
 * isolated database. Also static checks: every handler is guarded, the import script cannot
 * reach DATABASE_URL, and the navigation entries exist.
 * Needs --experimental-test-module-mocks (see the "test" script).
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type Session = { userId: string; email: string; fullName: string; role: string; avatarInitials: string } | null;
let session: Session = null;
const member: Session = { userId: "u-team", email: "t@x.ma", fullName: "Team One", role: "sales", avatarInitials: "TO" };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
let rows: Row[] = [];
let seq = 0;
let tick = 0;
const audits: { action: string; entityId?: string }[] = [];

const matches = (r: Row, where: Row = {}) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === "object" && !(v instanceof Date) && "not" in v) return r[k] !== v.not;
    if (v instanceof Date) return r[k] instanceof Date && r[k].getTime() === v.getTime();
    return r[k] === v;
  });
const stamp = () => new Date(Date.UTC(2026, 10, 1, 0, 0, tick++));

const contentPost = {
  findMany: async ({ where }: { where?: Row } = {}) => rows.filter((r) => matches(r, where)).map((r) => ({ ...r })),
  count: async ({ where }: { where?: Row } = {}) => rows.filter((r) => matches(r, where)).length,
  findUnique: async ({ where }: { where: { id: string } }) => {
    const r = rows.find((x) => x.id === where.id);
    return r ? { ...r } : null;
  },
  create: async ({ data }: { data: Row }) => {
    const t = stamp();
    const r = {
      id: `c${++seq}`, publishedAt: null, publishedUrl: "", archivedAt: null, sourceKey: null, metricsUpdatedAt: null,
      views: null, reach: null, likes: null, comments: null, saves: null, shares: null, follows: null,
      createdAt: t, updatedAt: t, ...data,
    };
    rows.push(r);
    return { ...r };
  },
  updateMany: async ({ where, data }: { where: Row; data: Row }) => {
    const hit = rows.filter((r) => matches(r, where));
    for (const r of hit) Object.assign(r, data, { updatedAt: stamp() });
    return { count: hit.length };
  },
};

mock.module("@/lib/auth", { namedExports: { getSession: async () => session } });
mock.module("@/lib/prisma", { namedExports: { prisma: { contentPost }, hasPrisma: () => true } });
mock.module("@/lib/audit", {
  namedExports: {
    getClientIp: () => "127.0.0.1",
    logAudit: async (a: { action: string; entityId?: string }) => { audits.push(a); },
  },
});

let list: typeof import("../src/app/api/admin/content/route");
let one: typeof import("../src/app/api/admin/content/[id]/route");
before(async () => {
  list = await import("../src/app/api/admin/content/route");
  one = await import("../src/app/api/admin/content/[id]/route");
});

const req = (method: string, body?: unknown, path = "/api/admin/content") =>
  new Request(`http://x${path}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const IG = "https://www.instagram.com/reel/XYZ123/";

async function createReady() {
  const res = await list.POST(req("POST", { title: "Fixture reel", format: "REEL", status: "READY", caption: "Cap", mediaPaths: ["r.mp4"] }));
  assert.equal(res.status, 201);
  return (await res.json()) as Row;
}

beforeEach(() => { rows = []; seq = 0; audits.length = 0; session = member; });

test("signed-out requests are refused on every handler", async () => {
  session = null;
  assert.equal((await list.GET(req("GET"))).status, 401);
  assert.equal((await list.POST(req("POST", { title: "T", format: "REEL" }))).status, 401);
  assert.equal((await one.GET(req("GET"), params("c1"))).status, 401);
  assert.equal((await one.PATCH(req("PATCH", { title: "x" }), params("c1"))).status, 401);
  assert.equal(rows.length, 0);
});

test("create: defaults to Idea, records the author, refuses Published and invalid bodies", async () => {
  const res = await list.POST(req("POST", { title: "  Idea one ", format: "CAROUSEL" }));
  assert.equal(res.status, 201);
  const post = await res.json();
  assert.equal(post.status, "IDEA");
  assert.equal(post.title, "Idea one");
  assert.equal(post.createdByName, "Team One");

  assert.equal((await list.POST(req("POST", { title: "T", format: "REEL", status: "PUBLISHED" }))).status, 400);
  assert.equal((await list.POST(req("POST", { title: "T", format: "REEL", status: "READY" }))).status, 400);
  assert.equal((await list.POST(new Request("http://x/api/admin/content", { method: "POST", body: "{not json" }))).status, 400);
  assert.equal(rows.length, 1);
});

test("list hides archived posts unless asked; archive is reversible", async () => {
  const a = await createReady();
  await createReady();
  assert.equal((await one.PATCH(req("PATCH", { archived: true }), params(a.id))).status, 200);

  const active = await (await list.GET(req("GET"))).json();
  assert.equal(active.posts.length, 1);
  assert.equal(active.archivedCount, 1);
  const archived = await (await list.GET(req("GET", undefined, "/api/admin/content?archived=true"))).json();
  assert.deepEqual(archived.posts.map((p: Row) => p.id), [a.id]);

  assert.equal((await one.PATCH(req("PATCH", { archived: false }), params(a.id))).status, 200);
  assert.equal(rows.find((r) => r.id === a.id)!.archivedAt, null);
});

test("publishing needs the explicit confirmation; it is audited; metrics only afterwards", async () => {
  const post = await createReady();
  const publish = { status: "PUBLISHED", publishedUrl: IG, publishedAt: "2026-10-01T10:00:00Z" };

  assert.equal((await one.PATCH(req("PATCH", { views: 5 }), params(post.id))).status, 400);
  assert.equal((await one.PATCH(req("PATCH", publish), params(post.id))).status, 400);
  assert.equal(rows[0].status, "READY");
  assert.equal(audits.length, 0);

  const res = await one.PATCH(req("PATCH", { ...publish, confirmPublished: true }), params(post.id));
  assert.equal(res.status, 200);
  const live = await res.json();
  assert.equal(live.status, "PUBLISHED");
  assert.equal(live.publishedUrl, IG);
  assert.deepEqual(audits.map((a) => a.action), ["CONTENT_PUBLISHED"]);

  const m = await one.PATCH(req("PATCH", { views: 1500, likes: 80 }), params(post.id));
  assert.equal(m.status, 200);
  assert.equal((await m.json()).views, 1500);

  assert.equal((await one.PATCH(req("PATCH", { status: "READY" }), params(post.id))).status, 400);
  const back = await one.PATCH(req("PATCH", { status: "READY", confirmUnpublish: true }), params(post.id));
  assert.equal(back.status, 200);
  const after = await back.json();
  assert.equal(after.status, "READY");
  assert.equal(after.publishedUrl, IG);
  assert.equal(after.views, 1500);
  assert.deepEqual(audits.map((a) => a.action), ["CONTENT_PUBLISHED", "CONTENT_UNPUBLISHED"]);
});

test("a concurrent change makes the write match nothing (409) instead of overwriting it", async () => {
  const post = await createReady();
  const realFind = contentPost.findUnique;
  // Simulate another editor publishing between this request's read and its write.
  contentPost.findUnique = async (args) => {
    const snapshot = await realFind(args);
    Object.assign(rows[0], { status: "PUBLISHED", publishedUrl: IG, publishedAt: new Date(), updatedAt: stamp() });
    contentPost.findUnique = realFind;
    return snapshot;
  };
  const res = await one.PATCH(req("PATCH", { title: "Edited" }), params(post.id));
  assert.equal(res.status, 409);
  assert.equal(rows[0].title, "Fixture reel");
  assert.equal(rows[0].status, "PUBLISHED");
});

test("unknown id → 404; unknown field → 400; empty change → unchanged row", async () => {
  assert.equal((await one.PATCH(req("PATCH", { title: "x" }), params("missing"))).status, 404);
  const post = await createReady();
  assert.equal((await one.PATCH(req("PATCH", { createdById: "u-evil" }), params(post.id))).status, 400);
  const before = rows[0].updatedAt;
  assert.equal((await one.PATCH(req("PATCH", {}), params(post.id))).status, 200);
  assert.equal(rows[0].updatedAt, before);
});

/* ---------- static checks ---------- */

const src = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("every content handler starts with requireTeam(); no bare getSession()", () => {
  for (const rel of ["src/app/api/admin/content/route.ts", "src/app/api/admin/content/[id]/route.ts"]) {
    const code = src(rel);
    const handlers = code.split(/\nexport\s+async\s+function\s+/).slice(1);
    assert.ok(handlers.length >= 2, rel);
    for (const h of handlers) {
      const open = /\)\s*(?::[^{\n]*)?\{\s*\n/.exec(h); // end of the signature (which may destructure `{ params }`)
      assert.ok(open, rel);
      const first = h.slice(open.index + open[0].length).split("\n").find((l) => l.trim() !== "");
      assert.match(first ?? "", /await requireTeam\(\)/, `${rel} ${h.slice(0, h.indexOf("("))}`);
    }
    assert.doesNotMatch(code, /getSession\(/, rel);
    assert.doesNotMatch(code, /\.delete(Many)?\(/, `${rel}: no hard deletes`);
  }
});

test("the import script never reads DATABASE_URL or .env and only accepts local hosts by default", () => {
  const code = src("scripts/import-content-calendar.ts");
  assert.doesNotMatch(code, /process\.env\.DATABASE_URL|process\.env\["DATABASE_URL"\]/);
  assert.doesNotMatch(code, /dotenv/);
  assert.match(code, /process\.env\.CONTENT_IMPORT_DATABASE_URL/);
  assert.match(code, /LOCAL_HOSTS = new Set\(\["localhost", "127\.0\.0\.1", "::1", "\[::1\]"\]\)/);
  assert.doesNotMatch(src("src/lib/content-calendar-import.ts"), /@prisma|@\/lib\/prisma/);
});

test("navigation: Content Planner sits in More and in the command palette", () => {
  assert.match(src("src/app/admin/layout.tsx"), /\{ href: "\/admin\/content", label: "Content Planner", icon: CalendarDays \}/);
  assert.match(src("src/components/admin/command-palette.tsx"), /href: "\/admin\/content"/);
});
