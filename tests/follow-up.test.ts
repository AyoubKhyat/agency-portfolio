/**
 * Phase 0 / A — a prospect who replied must never be chased again.
 *
 * The regression this guards: the queue used to filter on Prospect.status
 * alone, so marking an OutreachMessage as replied did nothing. A prospect who
 * answered stayed in the day-4 bucket until someone also remembered to move
 * their status to REPONDU.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeFollowUpBucket,
  isFollowUpSuppressed,
  DAY_MS,
} from "../src/lib/follow-up";

const NOW = new Date("2026-09-22T12:00:00Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * DAY_MS);

const base = {
  status: "ENVOYE",
  sentAt: null,
  followup1At: null,
  followup2At: null,
  followup3At: null,
  hasReply: false,
};

test("a reply suppresses follow-up even when status was never moved to REPONDU", () => {
  const repliedButStatusStale = {
    ...base,
    status: "ENVOYE", // nobody updated it
    sentAt: daysAgo(10),
    hasReply: true,
  };
  assert.equal(isFollowUpSuppressed(repliedButStatusStale), true);
  assert.equal(computeFollowUpBucket(repliedButStatusStale, NOW), null);
});

test("without a reply the same prospect IS due a day-4 follow-up", () => {
  const notReplied = { ...base, sentAt: daysAgo(10), hasReply: false };
  assert.equal(computeFollowUpBucket(notReplied, NOW), "due_day_4");
});

test("a reply suppresses every stage of the cadence", () => {
  const stages = [
    { ...base, sentAt: null },
    { ...base, sentAt: daysAgo(10) },
    { ...base, sentAt: daysAgo(30), followup1At: daysAgo(20) },
    { ...base, sentAt: daysAgo(40), followup1At: daysAgo(30), followup2At: daysAgo(20) },
  ];
  for (const s of stages) {
    assert.notEqual(computeFollowUpBucket({ ...s, hasReply: false }, NOW), null);
    assert.equal(computeFollowUpBucket({ ...s, hasReply: true }, NOW), null);
  }
});

test("terminal statuses still suppress follow-up on their own", () => {
  for (const status of ["REPONDU", "CLIENT", "CONVERTI", "LOST", "PAS_DE_WHATSAPP", "PERDU", "REFUSE"]) {
    assert.equal(
      computeFollowUpBucket({ ...base, status, sentAt: daysAgo(10) }, NOW),
      null,
      `${status} should be suppressed`,
    );
  }
});

test("bucket boundaries: not due before the interval, due on it", () => {
  assert.equal(computeFollowUpBucket({ ...base, sentAt: daysAgo(2) }, NOW), null);
  assert.equal(computeFollowUpBucket({ ...base, sentAt: daysAgo(3) }, NOW), "due_day_4");

  const after1 = { ...base, sentAt: daysAgo(30) };
  assert.equal(computeFollowUpBucket({ ...after1, followup1At: daysAgo(5) }, NOW), null);
  assert.equal(computeFollowUpBucket({ ...after1, followup1At: daysAgo(6) }, NOW), "due_day_10");

  const after2 = { ...after1, followup1At: daysAgo(30) };
  assert.equal(computeFollowUpBucket({ ...after2, followup2At: daysAgo(9) }, NOW), null);
  assert.equal(computeFollowUpBucket({ ...after2, followup2At: daysAgo(10) }, NOW), "due_day_20");
});

test("never contacted is the first bucket, and a completed cycle is not re-queued", () => {
  assert.equal(computeFollowUpBucket({ ...base, sentAt: null }, NOW), "never_contacted");
  assert.equal(
    computeFollowUpBucket(
      { ...base, sentAt: daysAgo(60), followup1At: daysAgo(50), followup2At: daysAgo(40), followup3At: daysAgo(30) },
      NOW,
    ),
    null,
  );
});
