/**
 * Content Planner workflow rules (src/lib/content-posts.ts): readiness per status, the
 * confirmation guards around Published, metrics, archive, and the planner view helpers.
 * Pure: no database, no session.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarDays,
  contentCreateSchema,
  contentUpdateSchema,
  followUps,
  isInstagramPostUrl,
  planContentCreate,
  planContentUpdate,
  readinessProblems,
  type ContentRow,
} from "../src/lib/content-posts";

const NOW = new Date("2026-11-10T12:00:00Z");
const IG = "https://www.instagram.com/p/ABC123/";

const row = (over: Partial<ContentRow> = {}): ContentRow => ({
  title: "Fixture post",
  format: "POST",
  status: "READY",
  plannedAt: new Date("2026-11-12T17:00:00Z"),
  caption: "Fixture caption",
  mediaPaths: ["media/one.png"],
  publishedUrl: "",
  publishedAt: null,
  archivedAt: null,
  ...over,
});

const update = (before: ContentRow, body: unknown) => {
  const parsed = contentUpdateSchema.safeParse(body);
  assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues));
  return planContentUpdate(before, parsed.data, NOW);
};

test("instagram links: only https instagram.com post / reel / story URLs", () => {
  for (const ok of [IG, "https://instagram.com/reel/XyZ/", "https://www.instagram.com/stories/ibda3.digital0/123/"]) {
    assert.equal(isInstagramPostUrl(ok), true, ok);
  }
  for (const bad of ["", "http://www.instagram.com/p/ABC/", "https://www.instagram.com/ibda3.digital0/", "https://evil.example/p/ABC/", "https://instagram.com.evil.example/p/A/", "not a url"]) {
    assert.equal(isInstagramPostUrl(bad), false, bad);
  }
});

test("readiness: Idea/Draft need a title; Ready needs media and caption (not for Stories)", () => {
  const empty = row({ caption: "", mediaPaths: [], status: "IDEA" });
  assert.deepEqual(readinessProblems(empty, "IDEA"), []);
  assert.deepEqual(readinessProblems(empty, "DRAFT"), []);
  assert.deepEqual(readinessProblems({ ...empty, title: "  " }, "DRAFT"), ["Add a title."]);
  assert.deepEqual(readinessProblems(empty, "READY"), ["Add at least one media file.", "Write the caption."]);
  assert.deepEqual(readinessProblems({ ...empty, format: "STORY", mediaPaths: ["s.mp4"] }, "READY"), []);
  assert.deepEqual(readinessProblems(row({ format: "CAROUSEL" }), "READY"), ["A carousel needs at least 2 slides."]);
  assert.deepEqual(readinessProblems(row({ format: "CAROUSEL", mediaPaths: ["1.png", "2.png"] }), "READY"), []);
});

test("readiness: Scheduled needs a planned date; Published needs the live link and the date", () => {
  assert.deepEqual(readinessProblems(row({ plannedAt: null }), "SCHEDULED"), ["Set the planned date."]);
  assert.deepEqual(readinessProblems(row(), "PUBLISHED"), ["Add the instagram.com link of the live post.", "Add the publication date."]);
  assert.deepEqual(readinessProblems(row({ publishedUrl: IG, publishedAt: NOW }), "PUBLISHED"), []);
});

test("create: never as Published, unknown fields refused, readiness enforced", () => {
  assert.equal(contentCreateSchema.safeParse({ title: "T", format: "REEL", status: "PUBLISHED" }).success, false);
  assert.equal(contentCreateSchema.safeParse({ title: "T", format: "REEL", publishedUrl: IG }).success, false);
  assert.equal(contentCreateSchema.safeParse({ title: "T", format: "TIKTOK" }).success, false);
  assert.equal(contentCreateSchema.safeParse({ title: "", format: "REEL" }).success, false);
  assert.equal(contentCreateSchema.safeParse({ title: "T", format: "POST", caption: "x".repeat(2201) }).success, false);

  const idea = planContentCreate(contentCreateSchema.parse({ title: "T", format: "REEL" }));
  assert.ok(idea.ok);
  assert.equal(idea.data.status, "IDEA");
  assert.deepEqual(idea.data.mediaPaths, []);

  const notReady = planContentCreate(contentCreateSchema.parse({ title: "T", format: "REEL", status: "READY" }));
  assert.equal(notReady.ok, false);
});

test("publishing needs confirmPublished, a valid link and a past date", () => {
  const before = row({ status: "SCHEDULED" });
  const base = { status: "PUBLISHED", publishedUrl: IG, publishedAt: "2026-11-10T09:00:00Z" };

  const unconfirmed = update(before, base);
  assert.equal(unconfirmed.ok, false);
  assert.match(!unconfirmed.ok ? unconfirmed.error : "", /Confirm/);

  assert.equal(contentUpdateSchema.safeParse({ ...base, confirmPublished: false }).success, false);

  const badLink = update(before, { ...base, publishedUrl: "https://example.com/x", confirmPublished: true });
  assert.equal(badLink.ok, false);

  const future = update(before, { ...base, publishedAt: "2026-11-12T09:00:00Z", confirmPublished: true });
  assert.equal(future.ok, false);
  assert.match(!future.ok ? future.error : "", /future/);

  const noDate = update(before, { status: "PUBLISHED", publishedUrl: IG, confirmPublished: true });
  assert.equal(noDate.ok, false);

  const ok = update(before, { ...base, confirmPublished: true });
  assert.ok(ok.ok);
  assert.equal(ok.event, "PUBLISHED");
  assert.equal(ok.data.status, "PUBLISHED");
  assert.equal(ok.data.publishedUrl, IG);
});

test("publication link/date cannot be set without publishing", () => {
  const res = update(row({ status: "READY" }), { publishedUrl: IG });
  assert.equal(res.ok, false);
});

test("leaving Published needs confirmUnpublish and keeps link and metrics", () => {
  const published = row({ status: "PUBLISHED", publishedUrl: IG, publishedAt: NOW });
  assert.equal(update(published, { status: "READY" }).ok, false);
  const ok = update(published, { status: "READY", confirmUnpublish: true });
  assert.ok(ok.ok);
  assert.equal(ok.event, "UNPUBLISHED");
  assert.equal("publishedUrl" in ok.data, false);
  assert.equal("views" in ok.data, false);
});

test("metrics: only on published posts; null clears; timestamp recorded", () => {
  assert.equal(update(row({ status: "SCHEDULED" }), { views: 10 }).ok, false);
  const published = row({ status: "PUBLISHED", publishedUrl: IG, publishedAt: NOW });
  const ok = update(published, { views: 1200, likes: 0, saves: null });
  assert.ok(ok.ok);
  assert.equal(ok.data.views, 1200);
  assert.equal(ok.data.likes, 0);
  assert.equal(ok.data.saves, null);
  assert.deepEqual(ok.data.metricsUpdatedAt, NOW);
  assert.equal(ok.event, null);
  assert.equal(contentUpdateSchema.safeParse({ views: -1 }).success, false);
  assert.equal(contentUpdateSchema.safeParse({ views: 1.5 }).success, false);
});

test("edits keep the current status valid; archive and restore", () => {
  assert.equal(update(row({ status: "READY" }), { caption: "" }).ok, false);
  assert.equal(update(row({ status: "SCHEDULED" }), { plannedAt: null }).ok, false);
  const back = update(row({ status: "READY" }), { status: "DRAFT", caption: "" });
  assert.ok(back.ok);

  const archived = update(row(), { archived: true });
  assert.ok(archived.ok);
  assert.deepEqual(archived.data.archivedAt, NOW);
  const restored = update(row({ archivedAt: NOW }), { archived: false });
  assert.ok(restored.ok);
  assert.equal(restored.data.archivedAt, null);
});

test("calendarDays: 30 consecutive local days across month ends; bad input → empty", () => {
  const days = calendarDays("2026-11-20", 30);
  assert.equal(days.length, 30);
  assert.equal(days[0], "2026-11-20");
  assert.equal(days[11], "2026-12-01");
  assert.equal(days[29], "2026-12-19");
  assert.deepEqual(calendarDays("20-11-2026"), []);
});

test("followUps: unpublished posts with a next action, soonest first, overdue flagged", () => {
  const base = { archivedAt: null as string | null };
  const list = followUps(
    [
      { ...base, id: "a", status: "DRAFT", nextAction: "Write caption", plannedAt: "2026-11-15T17:00:00Z" },
      { ...base, id: "b", status: "IDEA", nextAction: "Find visual", plannedAt: null },
      { ...base, id: "c", status: "DRAFT", nextAction: "Late", plannedAt: "2026-11-01T17:00:00Z" },
      { ...base, id: "d", status: "PUBLISHED", nextAction: "ignored", plannedAt: "2026-11-02T17:00:00Z" },
      { ...base, id: "e", status: "DRAFT", nextAction: "", plannedAt: "2026-11-03T17:00:00Z" },
      { id: "f", status: "DRAFT", nextAction: "archived", plannedAt: "2026-11-03T17:00:00Z", archivedAt: "2026-11-04T00:00:00Z" },
      { ...base, id: "g", status: "SCHEDULED", nextAction: "Check comments", plannedAt: "2026-11-02T17:00:00Z" },
    ],
    NOW,
  );
  assert.deepEqual(list.map((p) => p.id), ["c", "g", "a", "b"]);
  assert.deepEqual(list.map((p) => p.overdue), [true, false, false, false]);
});
