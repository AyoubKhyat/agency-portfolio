/**
 * Content Planner against a REAL, ISOLATED Postgres database: the API routes end to end through
 * Prisma, String[] media order, the concurrent-edit guard on real timestamps, and the calendar
 * import (create-only, idempotent, unique source keys, never Published).
 *
 * Skipped unless CONTENT_TEST_DATABASE_URL points at a local database (127.0.0.1 / localhost) that is
 * not the DATABASE_URL of this process or of .env; it refuses anything else, so it can never run
 * against the production database. Every test empties content_posts (only there). Example
 * (disposable container; schema = base schema + prisma/sql/20261028_add_content_posts.sql):
 *   docker run -d --name ibda3-content-testdb -e POSTGRES_USER=test -e POSTGRES_PASSWORD=testonly \
 *     -e POSTGRES_DB=ibda3_content_test -p 127.0.0.1:55440:5432 --tmpfs /var/lib/postgresql/data postgres:16-alpine
 *   CONTENT_TEST_DATABASE_URL=postgresql://test:testonly@127.0.0.1:55440/ibda3_content_test npm test
 */
import { test, mock, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const URL_ = process.env.CONTENT_TEST_DATABASE_URL ?? "";
const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return ""; } };
const envFileHost = (() => {
  try {
    return hostOf(/^DATABASE_URL=["']?([^"'\r\n]+)/m.exec(readFileSync(new URL("../.env", import.meta.url), "utf8"))?.[1] ?? "");
  } catch {
    return "";
  }
})();
const host = hostOf(URL_);
const isolated =
  URL_ !== "" &&
  ["127.0.0.1", "localhost"].includes(host) &&
  URL_ !== process.env.DATABASE_URL &&
  host !== envFileHost;
const skip = isolated ? false : "set CONTENT_TEST_DATABASE_URL to an isolated local database to run";

/* eslint-disable @typescript-eslint/no-explicit-any */
let client: any;
let list: typeof import("../src/app/api/admin/content/route");
let one: typeof import("../src/app/api/admin/content/[id]/route");
let importer: typeof import("../src/lib/content-calendar-import");
const audits: string[] = [];

before(async () => {
  if (!isolated) return;
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL_ }) });
  mock.module("@/lib/prisma", { namedExports: { prisma: client, hasPrisma: () => true } });
  mock.module("@/lib/auth", {
    namedExports: { getSession: async () => ({ userId: "u-team", email: "t@x.ma", fullName: "Team One", role: "sales", avatarInitials: "TO" }) },
  });
  mock.module("@/lib/audit", { namedExports: { getClientIp: () => "127.0.0.1", logAudit: async (a: { action: string }) => { audits.push(a.action); } } });
  list = await import("../src/app/api/admin/content/route");
  one = await import("../src/app/api/admin/content/[id]/route");
  importer = await import("../src/lib/content-calendar-import");
});
after(async () => { await client?.$disconnect(); });
beforeEach(async () => { if (isolated) await client.contentPost.deleteMany({}); audits.length = 0; });

const req = (method: string, body?: unknown) =>
  new Request("http://x/api/admin/content", { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const IG = "https://www.instagram.com/p/FIXTURE1/";

test("create → ready → publish (confirmed) → metrics → unpublish, persisted in Postgres", { skip }, async () => {
  const created = await list.POST(req("POST", {
    title: "Fixture carousel", format: "CAROUSEL", status: "READY", caption: "Caption",
    mediaPaths: ["slide-3.png", "slide-1.png", "slide-2.png"], plannedAt: "2026-11-05T17:00:00Z",
  }));
  assert.equal(created.status, 201);
  const { id } = await created.json();

  const stored = await client.contentPost.findUnique({ where: { id } });
  assert.deepEqual(stored.mediaPaths, ["slide-3.png", "slide-1.png", "slide-2.png"]);
  assert.equal(stored.plannedAt.toISOString(), "2026-11-05T17:00:00.000Z");
  assert.equal(stored.views, null);

  const publish = { status: "PUBLISHED", publishedUrl: IG, publishedAt: "2026-10-05T17:05:00Z" };
  assert.equal((await one.PATCH(req("PATCH", publish), params(id))).status, 400);
  assert.equal((await client.contentPost.findUnique({ where: { id } })).status, "READY");

  assert.equal((await one.PATCH(req("PATCH", { ...publish, confirmPublished: true }), params(id))).status, 200);
  assert.equal((await one.PATCH(req("PATCH", { views: 2400, saves: 31 }), params(id))).status, 200);
  let row = await client.contentPost.findUnique({ where: { id } });
  assert.equal(row.status, "PUBLISHED");
  assert.equal(row.views, 2400);
  assert.ok(row.metricsUpdatedAt instanceof Date);

  assert.equal((await one.PATCH(req("PATCH", { status: "READY", confirmUnpublish: true }), params(id))).status, 200);
  row = await client.contentPost.findUnique({ where: { id } });
  assert.equal(row.status, "READY");
  assert.equal(row.publishedUrl, IG);
  assert.equal(row.views, 2400);
  assert.deepEqual(audits, ["CONTENT_PUBLISHED", "CONTENT_UNPUBLISHED"]);
});

test("list: soonest planned first, unplanned last, archive separate", { skip }, async () => {
  for (const [title, plannedAt] of [["late", "2026-11-20T10:00:00Z"], ["none", null], ["early", "2026-11-02T10:00:00Z"]] as const) {
    assert.equal((await list.POST(req("POST", { title, format: "POST", plannedAt }))).status, 201);
  }
  const body = await (await list.GET(req("GET"))).json();
  assert.deepEqual(body.posts.map((p: { title: string }) => p.title), ["early", "late", "none"]);

  const early = body.posts[0].id;
  await one.PATCH(req("PATCH", { archived: true }), params(early));
  const after = await (await list.GET(req("GET"))).json();
  assert.equal(after.posts.length, 2);
  assert.equal(after.archivedCount, 1);
});

test("a write based on a stale read matches nothing (409) on real timestamps", { skip }, async () => {
  const { id } = await (await list.POST(req("POST", { title: "Original", format: "REEL" }))).json();
  const stale = await client.contentPost.findUnique({ where: { id } });
  await client.contentPost.update({ where: { id }, data: { title: "Changed elsewhere" } });
  const res = await client.contentPost.updateMany({ where: { id, status: stale.status, updatedAt: stale.updatedAt }, data: { title: "Overwrite" } });
  assert.equal(res.count, 0);
  assert.equal((await client.contentPost.findUnique({ where: { id } })).title, "Changed elsewhere");
});

test("calendar import: creates once, skips on re-run, never Published, keys unique in the database", { skip }, async () => {
  const records = importer.readCalendar(
    "day,format,title,caption,media,status\n1,Reel,Day one,Cap,r.mp4,Published\n2,Carousel,Day two,Cap,a.png|b.png,Ready\n3,Story,Day three,,,Idea\n",
    "csv",
  );
  const plan = importer.planCalendarImport(records, { startDate: "2026-11-02", defaultTime: "18:00", tzOffset: "+01:00", keyPrefix: "ibda3-30d" });
  assert.deepEqual(plan.errors, []);

  const store: import("../src/lib/content-calendar-import").ImportStore = {
    existingKeys: async (keys) =>
      (await client.contentPost.findMany({ where: { sourceKey: { in: keys } }, select: { sourceKey: true } })).map((r: { sourceKey: string }) => r.sourceKey),
    createMany: async (rows) => (await client.contentPost.createMany({ data: rows, skipDuplicates: true })).count,
  };

  const first = await importer.applyCalendarImport(store, plan, "Fixture import");
  assert.equal(first.created, 3);
  const again = await importer.applyCalendarImport(store, plan, "Fixture import");
  assert.equal(again.created, 0);
  assert.equal(again.skipped.length, 3);

  const rows = await client.contentPost.findMany({ orderBy: { plannedAt: "asc" } });
  assert.equal(rows.length, 3);
  assert.equal(rows.filter((r: { status: string }) => r.status === "PUBLISHED").length, 0);
  assert.deepEqual(rows.map((r: { status: string }) => r.status), ["READY", "READY", "IDEA"]);
  assert.equal(rows[0].plannedAt.toISOString(), "2026-11-02T17:00:00.000Z");
  assert.deepEqual(rows[1].mediaPaths, ["a.png", "b.png"]);
  assert.ok(rows[0].notes.includes(importer.PUBLISHED_CONFIRMATION_NOTE));

  await assert.rejects(client.contentPost.create({ data: { title: "dup", format: "REEL", sourceKey: rows[0].sourceKey } }));
});
