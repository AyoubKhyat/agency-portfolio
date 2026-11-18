/**
 * Legacy discovery permissions (Task 7B). The legacy discovery writes are owner or admin only; their reads stay
 * team; the Daily Lead Agent's Today import stays open to every team member through the shared import helper,
 * with its today's-list eligibility, duplicate re-check, attribution and bookkeeping unchanged.
 * Session, owner check, Prisma and the Daily Lead Agent store are mocked: no database.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { apiErrorMessage } from "../src/lib/api-error";

type Session = { userId: string; fullName: string; role: string; email: string; avatarInitials: string } | null;
const as = (role: string, userId = `u-${role}`): Session => ({ userId, fullName: `User ${role}`, role, email: `${role}@x.test`, avatarInitials: "U" });

type Row = Record<string, unknown> & { id: string };
const state = {
  session: as("sales") as Session,
  hasPrisma: true,
  prospects: [] as Row[],
  created: [] as Row[],
  prismaCalls: 0,
  marked: [] as { resultId: string; prospectId: string; by: { userId: string; fullName: string } }[],
  todayLeads: [] as Record<string, unknown>[],
};
const reset = (session: Session) => {
  state.session = session; state.hasPrisma = true; state.prospects = []; state.created = [];
  state.prismaCalls = 0; state.marked = []; state.todayLeads = [];
};

mock.module("@/lib/auth", { namedExports: { getSession: async () => state.session } });
mock.module("@/lib/account-security", { namedExports: { isOwner: async (s: { userId: string }) => s.userId === "owner-1" } });

/** Every Prisma call is counted, so a denied request can be shown to touch nothing. */
const counted = <T extends object>(model: T): T =>
  new Proxy(model, { get: (t, k) => { const v = (t as Record<string | symbol, unknown>)[k]; return typeof v === "function" ? (...a: unknown[]) => { state.prismaCalls++; return (v as (...x: unknown[]) => unknown)(...a); } : v; } });
const anyModel = () => counted(new Proxy({}, { get: () => async () => [] }) as Record<string, unknown>);
mock.module("@/lib/prisma", {
  namedExports: {
    hasPrisma: () => state.hasPrisma,
    prisma: new Proxy({
      prospect: counted({
        findMany: async () => state.prospects.map((p) => ({ ...p })),
        create: async ({ data }: { data: Row }) => {
          const row: Row = { ...data, id: `new${state.created.length}` }; state.created.push(row); return { id: row.id, name: row["name"] };
        },
      }),
      discoverySweep: counted({ updateMany: async () => ({ count: 0 }) }),
    } as Record<string, unknown>, { get: (t, k) => (k in t ? t[k as string] : anyModel()) }),
  },
});

mock.module("@/lib/daily-leads-store", {
  namedExports: {
    prismaDailyStore: {},
    getTodayLeads: async (day: string) => ({ day, run: null, leads: state.todayLeads }),
    importCandidate: (l: Record<string, unknown>) => ({
      sourceId: l.osmId, source: "OSM", name: l.name, sector: l.sector, city: "Marrakech", neighborhood: null,
      phone: null, rating: null, reviewCount: null, email: null, website: l.website || null,
      whatsapp: null, instagram: null, facebook: null, mapsUrl: l.osmUrl,
    }),
    markImported: async (resultId: string, prospectId: string, by: { userId: string; fullName: string }) => {
      state.marked.push({ resultId, prospectId, by: { userId: by.userId, fullName: by.fullName } }); return true;
    },
    // The notes the route saves with the prospect; built on the server from the stored lead.
    importNotes: (l: Record<string, unknown>) => [`Contact evidence for ${String(l.name)}`, `Website check for ${String(l.name)}`],
    getProspectContactEvidence: async () => null,
  },
});

const post = (body: unknown) => new Request("http://x/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const put = (body: unknown) => new Request("http://x/api", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const get = () => new Request("http://x/api?date=2026-11-17");
const candidate = (over: Record<string, unknown> = {}) => ({
  sourceId: "node/1", source: "OSM", name: "Riad Test", sector: "RIADS", city: "Marrakech", website: "https://riad-test.ma", ...over,
});
const lead = (over: Record<string, unknown> = {}) => ({
  resultId: "r1", osmId: "node/77", name: "Dar Today", sector: "RIADS", website: "https://dar-today.ma",
  osmUrl: "https://www.openstreetmap.org/node/77", importedProspectId: null, ...over,
});

/* ───────────────── The 9 restricted handlers ───────────────── */

const restricted: [string, () => Promise<Response>][] = [
  ["prospect-discovery/search POST", async () => (await import("../src/app/api/admin/prospect-discovery/search/route")).POST(post({ city: "MARRAKECH", sector: "RIADS" }))],
  ["prospect-discovery/sweeps POST", async () => (await import("../src/app/api/admin/prospect-discovery/sweeps/route")).POST(post({}))],
  ["prospect-discovery/import POST", async () => (await import("../src/app/api/admin/prospect-discovery/import/route")).POST(post({ candidates: [candidate()] }))],
  ["prospect-discovery/campaigns POST", async () => (await import("../src/app/api/admin/prospect-discovery/campaigns/route")).POST(post({ name: "C", prospectIds: ["p1"], ownerId: "u2" }))],
  ["prospect-discovery/targets PUT", async () => (await import("../src/app/api/admin/prospect-discovery/targets/route")).PUT(put({ userId: "u2", date: "2026-11-17", targetImports: 99 }))],
  ["discovery/search POST", async () => (await import("../src/app/api/admin/discovery/search/route")).POST(post({ query: "riads in Marrakech" }))],
  ["discovery/preview POST", async () => (await import("../src/app/api/admin/discovery/preview/route")).POST(post({ discoveryResultId: "d1", channel: "email" }))],
  ["discovery/import POST", async () => (await import("../src/app/api/admin/discovery/import/route")).POST(post({ discoveryResultId: "d1" }))],
  ["data-audit POST", async () => (await import("../src/app/api/admin/data-audit/route")).POST(post({ action: "REFRESH_QUALITY_LABELS" }))],
];

for (const role of ["sales", "designer", "developer"]) {
  test(`a ${role} is refused (403) by every legacy discovery write, before any database call`, async () => {
    for (const [name, call] of restricted) {
      reset(as(role));
      const res = await call();
      assert.equal(res.status, 403, name);
      assert.equal((await res.json()).error, "Only the owner or an admin can do this", name);
      assert.equal(state.prismaCalls, 0, `${name}: no database call`);
      assert.equal(state.created.length, 0, name);
    }
  });
}

test("without a session every legacy discovery write is 401", async () => {
  for (const [name, call] of restricted) {
    reset(null);
    assert.equal((await call()).status, 401, name);
    assert.equal(state.prismaCalls, 0, name);
  }
});

test("the import API: an admin and the owner (any role) import; Find businesses' request shape is unchanged", async () => {
  const { POST } = await import("../src/app/api/admin/prospect-discovery/import/route");
  for (const s of [as("admin"), as("Admin "), as("sales", "owner-1")]) {
    reset(s);
    const res = await POST(post({ candidates: [candidate()], allowPossibleDuplicates: false }));
    assert.equal(res.status, 200, s!.role);
    const body = await res.json();
    assert.equal(body.imported, 1);
    assert.equal(state.created[0].lastActionByUserId, s!.userId, "attributed to the importing user");
    assert.equal(state.created[0].source, "DISCOVERY_OSM");
  }
  reset(as("admin"));
  const bad = await POST(post({ candidates: [] }));
  assert.equal(bad.status, 400, "validation unchanged");
});

test("the import API during a database outage: 503 for an admin, still 403/401 for others, body never read", async () => {
  const { POST } = await import("../src/app/api/admin/prospect-discovery/import/route");
  const unreadable = () => new Request("http://x/api", { method: "POST", body: "not json" });
  for (const [s, status] of [[as("admin"), 503], [as("sales", "owner-1"), 503], [as("sales"), 403], [null, 401]] as const) {
    reset(s);
    state.hasPrisma = false;
    const res = await POST(unreadable());
    assert.equal(res.status, status, s ? `${s.role}/${s.userId}` : "no session");
    if (status === 503) assert.deepEqual(await res.json(), { error: "DB unavailable" });
    assert.equal(state.prismaCalls, 0);
  }
});

/* ───────────────── Reads stay team ───────────────── */

test("a sales user still reads sweeps, campaigns, targets, coverage, sectors, Data Audit and sweep checks", async () => {
  const reads: [string, () => Promise<Response>][] = [
    ["sweeps GET", async () => (await import("../src/app/api/admin/prospect-discovery/sweeps/route")).GET(get())],
    ["sweeps/check POST", async () => (await import("../src/app/api/admin/prospect-discovery/sweeps/check/route")).POST(post({ queries: [] }))],
    ["campaigns GET", async () => (await import("../src/app/api/admin/prospect-discovery/campaigns/route")).GET()],
    ["targets GET", async () => (await import("../src/app/api/admin/prospect-discovery/targets/route")).GET(get())],
    ["coverage GET", async () => (await import("../src/app/api/admin/prospect-discovery/coverage/route")).GET()],
    ["sectors GET", async () => (await import("../src/app/api/admin/prospect-discovery/sectors/route")).GET()],
    ["data-audit GET", async () => (await import("../src/app/api/admin/data-audit/route")).GET()],
  ];
  for (const [name, call] of reads) {
    reset(as("sales"));
    state.hasPrisma = false; // past the guard, each answers without a database
    const res = await call();
    assert.ok(res.status !== 401 && res.status !== 403, `${name}: ${res.status}`);
  }
});

/* ───────────────── Daily Lead Agent: Today import stays team ───────────────── */

const daily = () => import("../src/app/api/admin/daily-leads/route");

test("Today: a sales user imports one of today's leads, attributed to them, and the lead is marked imported", async () => {
  reset(as("sales"));
  state.todayLeads = [lead()];
  const res = await (await daily()).POST(post({ action: "import", resultId: "r1" }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { prospectId: "new0" });
  assert.equal(state.created.length, 1);
  const p = state.created[0];
  assert.equal(p.name, "Dar Today");
  assert.equal(p.lastActionByUserId, "u-sales");
  assert.equal(p.ownerUserId, null, "Today can't assign an owner");
  assert.equal(p.campaignId, null, "Today can't set a campaign");
  assert.equal(p.whatsappLink, "", "no WhatsApp link without an explicit one");
  assert.deepEqual(state.marked, [{ resultId: "r1", prospectId: "new0", by: { userId: "u-sales", fullName: "User sales" } }]);
  // The evidence notes are saved in the same write as the prospect, attributed to the importer.
  const notes = (p.notes as { create: { content: string; authorId: string; authorName: string }[] }).create;
  assert.deepEqual(notes, [
    { content: "Contact evidence for Dar Today", authorId: "u-sales", authorName: "User sales" },
    { content: "Website check for Dar Today", authorId: "u-sales", authorName: "User sales" },
  ]);
});

test("Today: only a lead of today's list, only once", async () => {
  reset(as("sales"));
  state.todayLeads = [lead()];
  const missing = await (await daily()).POST(post({ action: "import", resultId: "not-today" }));
  assert.equal(missing.status, 404);
  reset(as("sales"));
  state.todayLeads = [lead({ importedProspectId: "p-old" })];
  const again = await (await daily()).POST(post({ action: "import", resultId: "r1" }));
  assert.deepEqual(await again.json(), { prospectId: "p-old", already: true });
  assert.equal(state.created.length, 0);
  assert.equal(state.marked.length, 0);
});

test("Today: a lead already in the CRM is skipped (409) and not marked imported", async () => {
  reset(as("sales"));
  state.todayLeads = [lead()];
  state.prospects = [{ id: "p1", name: "Another Name", phone: "", instagram: "", whatsappLink: "", neighborhood: "", sector: "Riads", website: "https://www.dar-today.ma", email: "" }];
  const res = await (await daily()).POST(post({ action: "import", resultId: "r1" }));
  assert.equal(res.status, 409);
  assert.equal((await res.json()).skipped, "Same website domain");
  assert.equal(state.created.length, 0);
  assert.equal(state.marked.length, 0);
});

test("Today: the client can't widen the import (extra fields are rejected), and starting a run stays owner or admin", async () => {
  reset(as("sales"));
  state.todayLeads = [lead()];
  const widened = await (await daily()).POST(post({ action: "import", resultId: "r1", ownerId: "u2", allowPossibleDuplicates: true }));
  assert.equal(widened.status, 400);
  assert.equal(state.created.length, 0);
  const run = await (await daily()).POST(post({ action: "run" }));
  assert.equal(run.status, 403);
  reset(null);
  assert.equal((await (await daily()).POST(post({ action: "import", resultId: "r1" }))).status, 401);
});

test("the cron route never imports and keeps its own secret check", () => {
  const cron = readFileSync(new URL("../src/app/api/cron/daily-leads/route.ts", import.meta.url), "utf8");
  assert.match(cron, /cronAuthorized\(req\.headers\.get\("authorization"\)\)/);
  assert.doesNotMatch(cron, /prospect-import|prospect-discovery\/import|@\/lib\/authz/);
});

/* ───────────────── UI: clear errors; a failed Bulk Sweep import marks nothing ───────────────── */

test("apiErrorMessage shows the server's reason, else the fallback and status", async () => {
  const res = (status: number, body: unknown) => ({ status, json: async () => { if (body === undefined) throw new Error("no body"); return body; } });
  assert.equal(await apiErrorMessage(res(403, { error: "Only the owner or an admin can do this" }), "Import failed"), "Only the owner or an admin can do this");
  assert.equal(await apiErrorMessage(res(502, { message: "Overpass timed out" }), "Import failed"), "Overpass timed out");
  assert.equal(await apiErrorMessage(res(500, undefined), "Import failed"), "Import failed (500)");
  assert.equal(await apiErrorMessage(res(400, { error: "  " }), "Import failed"), "Import failed (400)");
});

test("Bulk Sweep: a failed import batch stops and marks nothing EXISTS; a denied search stops the sweep", () => {
  const src = readFileSync(new URL("../src/app/admin/prospect-discovery/_components/BulkSweepTab.tsx", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("async function importAllNew()"), src.indexOf("async function importAllNew()") + 3000);
  assert.match(fn, /if \(!res\.ok\) \{\s*failure = await apiErrorMessage\(res, "Import failed"\);\s*break;\s*\}/);
  assert.match(fn, /for \(const b of batch\) accepted\.add\(b\.name\);/, "only accepted batches count");
  assert.match(fn, /accepted\.has\(r\.name\) \? \{ \.\.\.r, duplicateStatus: "EXISTS" as const \}/);
  assert.doesNotMatch(fn, /new Set\(toImport\.map/, "no longer marks every selected business");
  assert.match(src, /if \(res\.status === 401 \|\| res\.status === 403\) denied = true;/);
  assert.match(src, /if \(denied\) break;/);
  assert.match(src, /\{importError && \(\s*<div role="alert"/);
});

test("Prospect Discovery import and targets, and Data Audit fixes, show the server's reason", () => {
  const pd = readFileSync(new URL("../src/app/admin/prospect-discovery/page.tsx", import.meta.url), "utf8");
  assert.match(pd, /setImportError\(await apiErrorMessage\(res, "Import failed"\)\)/);
  assert.match(pd, /setSaveError\(await apiErrorMessage\(res, "Couldn't save the target"\)\)/);
  assert.match(pd, /\{importError && \(/);
  assert.match(pd, /\{saveError && \(/);
  const da = readFileSync(new URL("../src/app/admin/data-audit/page.tsx", import.meta.url), "utf8");
  assert.match(da, /setFixError\(await apiErrorMessage\(res, "The fix didn't run"\)\)/);
  assert.match(da, /\{fixError && \(/);
});
