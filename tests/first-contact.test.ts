/**
 * Phase 0 / B — sentAt is the first-contact anchor and must never move.
 *
 * The regression this guards: bulkUpdateStatus used to set
 * `sentAt: new Date()` unconditionally, so a bulk move to ENVOYE reset the
 * anchor on every already-contacted prospect in the selection. That silently
 * re-queued them for INITIAL outreach — the mechanism by which a business
 * receives a first-contact message twice.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bulkUpdateStatusWith,
  updateProspectStatusWith,
  stampFirstContactIfUnset,
  type ProspectStatusWriter,
} from "../src/lib/prospect-first-contact";

type Row = { id: string; status: string; sentAt: Date | null };

/** Minimal in-memory stand-in honouring the `sentAt: null` WHERE clause. */
function fakeDb(rows: Row[]) {
  const calls: Array<{ op: string; where: Record<string, unknown>; data: Record<string, unknown> }> = [];

  function matches(row: Row, where: Record<string, unknown>): boolean {
    const idFilter = where.id as string | { in: string[] } | undefined;
    if (typeof idFilter === "string" && row.id !== idFilter) return false;
    if (idFilter && typeof idFilter === "object" && !idFilter.in.includes(row.id)) return false;
    if ("sentAt" in where && where.sentAt === null && row.sentAt !== null) return false;
    const statusFilter = where.status as { notIn: string[] } | undefined;
    if (statusFilter && statusFilter.notIn.includes(row.status)) return false;
    return true;
  }

  const client: ProspectStatusWriter = {
    prospect: {
      async updateMany({ where, data }) {
        calls.push({ op: "updateMany", where, data });
        let count = 0;
        for (const row of rows) {
          if (!matches(row, where)) continue;
          Object.assign(row, data);
          count++;
        }
        return { count };
      },
      async update({ where, data }) {
        calls.push({ op: "update", where, data });
        const row = rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
    },
  };
  return { client, rows, calls };
}

const T0 = new Date("2026-01-01T00:00:00Z");
const NOW = new Date("2026-09-22T12:00:00Z");

test("null sentAt -> moving to ENVOYE sets the anchor", async () => {
  const db = fakeDb([{ id: "a", status: "A_ENVOYER", sentAt: null }]);
  await updateProspectStatusWith(db.client, "a", "ENVOYE", NOW);
  assert.deepEqual(db.rows[0].sentAt, NOW);
  assert.equal(db.rows[0].status, "ENVOYE");
});

test("existing sentAt -> moving to ENVOYE preserves the original anchor", async () => {
  const db = fakeDb([{ id: "a", status: "ENVOYE", sentAt: T0 }]);
  await updateProspectStatusWith(db.client, "a", "ENVOYE", NOW);
  assert.deepEqual(db.rows[0].sentAt, T0, "first-contact anchor must not move");
});

test("bulk move to ENVOYE preserves existing anchors and stamps only the unset ones", async () => {
  const db = fakeDb([
    { id: "old1", status: "ENVOYE", sentAt: T0 },
    { id: "old2", status: "ENVOYE", sentAt: T0 },
    { id: "fresh", status: "A_ENVOYER", sentAt: null },
  ]);

  await bulkUpdateStatusWith(db.client, ["old1", "old2", "fresh"], "ENVOYE", NOW);

  assert.deepEqual(db.rows[0].sentAt, T0, "old1 anchor moved");
  assert.deepEqual(db.rows[1].sentAt, T0, "old2 anchor moved");
  assert.deepEqual(db.rows[2].sentAt, NOW, "fresh should be stamped");
  assert.ok(db.rows.every((r) => r.status === "ENVOYE"));
});

test("the status-setting write never carries sentAt in its payload", async () => {
  const db = fakeDb([{ id: "a", status: "A_ENVOYER", sentAt: null }]);
  await bulkUpdateStatusWith(db.client, ["a"], "ENVOYE", NOW);

  const statusWrite = db.calls.find((c) => "status" in c.data);
  assert.ok(statusWrite, "expected a status write");
  assert.equal("sentAt" in statusWrite.data, false, "status write must not touch sentAt");

  const stampWrite = db.calls.find((c) => "sentAt" in c.data);
  assert.ok(stampWrite, "expected a stamp write");
  assert.equal(stampWrite.where.sentAt, null, "stamp must be guarded by sentAt: null");
});

test("non-ENVOYE statuses never stamp sentAt", async () => {
  const db = fakeDb([{ id: "a", status: "A_ENVOYER", sentAt: null }]);
  await bulkUpdateStatusWith(db.client, ["a"], "LOST", NOW);
  assert.equal(db.rows[0].sentAt, null);
  assert.equal(db.rows[0].status, "LOST");
});

test("empty id list is a no-op", async () => {
  const db = fakeDb([{ id: "a", status: "A_ENVOYER", sentAt: null }]);
  const res = await bulkUpdateStatusWith(db.client, [], "ENVOYE", NOW);
  assert.equal(res.count, 0);
  assert.equal(db.calls.length, 0);
  assert.equal(db.rows[0].sentAt, null);

  const stamp = await stampFirstContactIfUnset(db.client, [], NOW);
  assert.equal(stamp.count, 0);
});

// ── Phase 0 / G — the write layer never pulls a replied prospect back ──────

test("Studio KA pattern at the write layer: REPONDU + ENVOYE keeps REPONDU", async () => {
  const db = fakeDb([{ id: "ka", status: "REPONDU", sentAt: T0 }]);
  await updateProspectStatusWith(db.client, "ka", "ENVOYE", NOW);
  assert.equal(db.rows[0].status, "REPONDU", "a send must not undo a reply");
  assert.deepEqual(db.rows[0].sentAt, T0, "anchor still untouched");
});

test("single ENVOYE write is guarded in its WHERE clause, not by a prior read", async () => {
  const db = fakeDb([{ id: "a", status: "A_ENVOYER", sentAt: null }]);
  await updateProspectStatusWith(db.client, "a", "ENVOYE", NOW);
  const statusWrite = db.calls.find((c) => "status" in c.data);
  assert.ok(statusWrite);
  const guard = statusWrite.where.status as { notIn: string[] };
  assert.ok(guard.notIn.includes("REPONDU"));
});

test("bulk ENVOYE skips post-reply prospects and moves the rest", async () => {
  const db = fakeDb([
    { id: "fresh", status: "A_ENVOYER", sentAt: null },
    { id: "nowa", status: "PAS_DE_WHATSAPP", sentAt: null },
    { id: "replied", status: "REPONDU", sentAt: T0 },
    { id: "meeting", status: "MEETING", sentAt: T0 },
    { id: "client", status: "CLIENT", sentAt: T0 },
  ]);
  const res = await bulkUpdateStatusWith(db.client, db.rows.map((r) => r.id), "ENVOYE", NOW);
  const status = Object.fromEntries(db.rows.map((r) => [r.id, r.status]));
  assert.deepEqual(status, {
    fresh: "ENVOYE", nowa: "ENVOYE",
    replied: "REPONDU", meeting: "MEETING", client: "CLIENT",
  });
  assert.equal(res.count, 2, "count reports only rows actually moved");
});

test("explicit non-ENVOYE moves out of REPONDU are not blocked", async () => {
  const db = fakeDb([{ id: "a", status: "REPONDU", sentAt: T0 }]);
  await updateProspectStatusWith(db.client, "a", "LOST", NOW);
  assert.equal(db.rows[0].status, "LOST");
});
