/**
 * Legacy AI Discovery import (/api/admin/discovery/import): a phone number never becomes a WhatsApp link.
 * The rest of its behaviour (duplicate recheck, 409s, activity row) is unchanged. Prisma, session and the
 * duplicate check are mocked: no database.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

type Row = Record<string, unknown>;
const state = {
  result: null as Row | null,
  duplicate: { status: "NEW", reason: null as string | null, prospectId: null as string | null, prospectName: null as string | null },
  created: [] as Row[],
};

mock.module("@/lib/auth", { namedExports: { getSession: async () => ({ userId: "u1", fullName: "Test User", role: "admin" }) } });
mock.module("@/lib/discovery/duplicates", { namedExports: { detectDuplicate: async () => state.duplicate } });
mock.module("@/lib/prisma", {
  namedExports: {
    hasPrisma: () => true,
    prisma: {
      discoveryResult: { findUnique: async () => state.result, update: async () => ({}) },
      prospect: {
        create: async ({ data }: { data: Row }) => { state.created.push(data); return { id: "new1", ...data }; },
        update: async () => ({}),
      },
      prospectActivity: { create: async () => ({}) },
      discoverySweep: { update: async () => ({}) },
      $transaction: async (ops: unknown[]) => ops,
    },
  },
});

const route = import("../src/app/api/admin/discovery/import/route");
const result = (over: Row = {}): Row => ({
  id: "r1", name: "Riad Test", phone: "+212 6 12 34 56 78", email: "", instagram: "", website: "https://riad-test.ma",
  city: "Marrakech", country: "MA", sector: "Riads", sourceUrl: "", opportunityScore: 70, confidenceScore: 60,
  suggestedSegment: "LEGACY_COLD", duplicateStatus: "NEW", duplicateProspectId: null, importedProspectId: null, sweepId: null, ...over,
});
async function post(body: object) {
  const { POST } = await route;
  const res = await POST(new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
}

test("a phone number is kept as a phone and never becomes a WhatsApp link", async () => {
  state.result = result(); state.created = []; state.duplicate = { status: "NEW", reason: null, prospectId: null, prospectName: null };
  const r = await post({ discoveryResultId: "r1" });
  assert.equal(r.status, 201);
  assert.equal(state.created[0].whatsappLink, "");
  assert.equal(state.created[0].phone, "+212 6 12 34 56 78");
  assert.notEqual(state.created[0].whatsappStatus, "VERIFIED");
});

test("unchanged: duplicates are refused, possible duplicates need review, already-imported results are refused", async () => {
  state.created = [];
  state.result = result(); state.duplicate = { status: "EXISTS", reason: "Same website", prospectId: "p1", prospectName: "Old" };
  assert.equal((await post({ discoveryResultId: "r1" })).status, 409);
  state.duplicate = { status: "POSSIBLE", reason: "Similar name", prospectId: "p1", prospectName: "Old" };
  const possible = await post({ discoveryResultId: "r1" });
  assert.equal(possible.status, 409);
  assert.equal(possible.body.needsManualReview, true);
  state.result = result({ importedProspectId: "p9" });
  assert.equal((await post({ discoveryResultId: "r1" })).status, 409);
  assert.equal(state.created.length, 0);
});
