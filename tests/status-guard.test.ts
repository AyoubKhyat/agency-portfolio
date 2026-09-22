/**
 * Phase 0 / G — a send action can never move a prospect backward.
 *
 * Production incident this guards (Studio KA, 2026-07-01):
 *   07:54:20  MARKED_REPLIED  ENVOYE  -> REPONDU
 *   07:54:52  SENT_INSTAGRAM  REPONDU -> ENVOYE   <- reply undone, 32s later
 * The prospect was put back in the cold follow-up queue.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POST_REPLY_STATUSES,
  isPostReplyStatus,
  resolveStatusChange,
} from "../src/lib/prospect-status-guard";

test("Studio KA sequence: MARKED_REPLIED then SENT_INSTAGRAM stays REPONDU", () => {
  let status = "ENVOYE";
  status = resolveStatusChange(status, "REPONDU").status; // MARKED_REPLIED
  assert.equal(status, "REPONDU");

  const send = resolveStatusChange(status, "ENVOYE"); // SENT_INSTAGRAM
  assert.equal(send.status, "REPONDU");
  assert.equal(send.preserved, true);

  const again = resolveStatusChange(send.status, "ENVOYE"); // second SENT_INSTAGRAM
  assert.equal(again.status, "REPONDU");
});

test("every post-reply status is preserved against a send", () => {
  for (const s of POST_REPLY_STATUSES) {
    const r = resolveStatusChange(s, "ENVOYE");
    assert.equal(r.status, s, `${s} was moved back to ENVOYE`);
    assert.equal(r.preserved, true);
  }
});

test("not-yet-contacted prospects still move to ENVOYE normally", () => {
  for (const s of ["A_ENVOYER", "PAS_DE_WHATSAPP", "ENVOYE", "", null, undefined]) {
    const r = resolveStatusChange(s, "ENVOYE");
    assert.equal(r.status, "ENVOYE", `from ${String(s)}`);
    assert.equal(r.preserved, false);
  }
});

test("non-ENVOYE requests pass through untouched, including from REPONDU", () => {
  assert.deepEqual(resolveStatusChange("REPONDU", "MEETING"), { status: "MEETING", preserved: false });
  assert.deepEqual(resolveStatusChange("REPONDU", "LOST"), { status: "LOST", preserved: false });
  assert.deepEqual(resolveStatusChange("ENVOYE", "REPONDU"), { status: "REPONDU", preserved: false });
  assert.deepEqual(resolveStatusChange("MEETING", "A_ENVOYER"), { status: "A_ENVOYER", preserved: false });
});

test("status vocabulary: PAS_DE_WHATSAPP and pre-reply states are not post-reply", () => {
  assert.equal(isPostReplyStatus("REPONDU"), true);
  assert.equal(isPostReplyStatus("A_ENVOYER"), false);
  assert.equal(isPostReplyStatus("ENVOYE"), false);
  assert.equal(isPostReplyStatus("PAS_DE_WHATSAPP"), false);
  assert.equal(isPostReplyStatus(null), false);
});
