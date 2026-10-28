/**
 * 30-day calendar import (src/lib/content-calendar-import.ts): CSV/JSON reading, date
 * planning from a configurable start date, status mapping (never Published), stable keys,
 * and create-only application. Pure: the store is an in-memory fake; no database.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyCalendarImport,
  parseCsv,
  planCalendarImport,
  readCalendar,
  PUBLISHED_CONFIRMATION_ACTION,
  PUBLISHED_CONFIRMATION_NOTE,
  type ImportStore,
} from "../src/lib/content-calendar-import";

const OPTS = { startDate: "2026-11-02", defaultTime: "18:00", tzOffset: "+01:00", keyPrefix: "ibda3-30d" };

const csv = (body: string) => readCalendar(`day,time,format,title,caption,media,status,next_action,notes,key\n${body}`, "csv");

test("parseCsv: quotes, doubled quotes, commas and newlines in fields, CRLF, BOM, blank lines", () => {
  const rows = parseCsv('﻿a,b,c\r\n1,"x, y","say ""hi""\nline 2"\r\n\r\n2,,\n');
  assert.deepEqual(rows, [["a", "b", "c"], ["1", "x, y", 'say "hi"\nline 2'], ["2", "", ""]]);
});

test("Day N is planned on start + N−1 at the row time or the default, in the given offset", () => {
  const plan = planCalendarImport(csv("1,,Reel,First,,,,,,\n30,09:30,post,Last,,,,,,"), OPTS);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.posts[0].data.plannedAt!.toISOString(), "2026-11-02T17:00:00.000Z");
  assert.equal(plan.posts[1].data.plannedAt!.toISOString(), "2026-12-01T08:30:00.000Z");
  const later = planCalendarImport(csv("1,,Reel,First,,,,,,"), { ...OPTS, startDate: "2027-01-10" });
  assert.equal(later.posts[0].data.plannedAt!.toISOString(), "2027-01-10T17:00:00.000Z");
});

test("formats and statuses accept common English/French spellings", () => {
  const plan = planCalendarImport(
    csv("1,,Carrousel,A,,,brouillon,,,\n2,,Stories,B,,s.mp4,Prêt,,,\n3,,static post,C,,,idée,,,\n4,,REEL,D,,,,,,"),
    OPTS,
  );
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.posts.map((p) => [p.data.format, p.data.status]), [
    ["CAROUSEL", "DRAFT"], ["STORY", "READY"], ["POST", "IDEA"], ["REEL", "IDEA"],
  ]);
});

test("the import never produces PUBLISHED; 'published' rows are flagged for confirmation", () => {
  const plan = planCalendarImport(csv('1,,Post,Done one,"Caption",a.png,Published,,"Shot on day 1",\n2,,Post,Done two,,,publié,,,'), OPTS);
  assert.deepEqual(plan.errors, []);
  for (const p of plan.posts) {
    assert.notEqual(p.data.status, "PUBLISHED");
    assert.equal(p.sourceSaysPublished, true);
    assert.ok(p.data.notes.includes(PUBLISHED_CONFIRMATION_NOTE));
    assert.equal(p.data.nextAction, PUBLISHED_CONFIRMATION_ACTION);
  }
  assert.equal(plan.posts[0].data.status, "READY");
  assert.ok(plan.posts[0].data.notes.startsWith("Shot on day 1"));
  assert.equal(plan.posts[1].data.status, "DRAFT"); // no caption/media → lowered
});

test("a status the content cannot support yet is lowered with a warning", () => {
  const plan = planCalendarImport(csv("1,,Carousel,Slides,Caption,one.png,Scheduled,,,"), OPTS);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.posts[0].data.status, "DRAFT");
  assert.equal(plan.posts[0].warnings.length, 2);
});

test("media column splits on | in slide order; next action and notes kept", () => {
  const plan = planCalendarImport(csv('1,,Carousel,Slides,Cap,"s1.png | s2.png|s3.png",Ready,Export slides,Note,'), OPTS);
  assert.deepEqual(plan.posts[0].data.mediaPaths, ["s1.png", "s2.png", "s3.png"]);
  assert.equal(plan.posts[0].data.status, "READY");
  assert.equal(plan.posts[0].data.nextAction, "Export slides");
});

test("stable keys: day + format by default, key column when given; duplicates refused", () => {
  const plan = planCalendarImport(csv("7,,Reel,A,,,,,,\n7,,Story,B,,,,,,\n8,,Post,C,,,,,,Launch Day"), OPTS);
  assert.deepEqual(plan.posts.map((p) => p.sourceKey), ["ibda3-30d:day-07-reel", "ibda3-30d:day-07-story", "ibda3-30d:launch-day"]);
  const dup = planCalendarImport(csv("7,,Reel,A,,,,,,\n7,,Reel,B,,,,,,"), OPTS);
  assert.equal(dup.errors.length, 1);
  assert.match(dup.errors[0], /Row 3: duplicate key/);
});

test("bad rows and options are reported with row numbers", () => {
  const plan = planCalendarImport(csv("0,,Reel,A,,,,,,\n2,,TikTok,B,,,,,,\n3,25:00,Reel,C,,,,,,\n4,,Reel,,,,,,,\n5,,Reel,E,,,maybe,,,"), OPTS);
  assert.equal(plan.posts.length, 0);
  assert.equal(plan.errors.length, 5);
  assert.match(plan.errors[0], /^Row 2: day/);
  assert.match(plan.errors[1], /^Row 3: format/);
  assert.match(plan.errors[2], /^Row 4: time/);
  assert.match(plan.errors[3], /^Row 5: title/);
  assert.match(plan.errors[4], /^Row 6: status/);
  for (const bad of [{ startDate: "02/11/2026" }, { defaultTime: "6pm" }, { tzOffset: "UTC+1" }, { keyPrefix: "Bad Prefix" }]) {
    assert.equal(planCalendarImport(csv("1,,Reel,A,,,,,,"), { ...OPTS, ...bad }).errors.length, 1, JSON.stringify(bad));
  }
});

test("JSON calendars: arrays become media lists", () => {
  const recs = readCalendar(JSON.stringify([{ Day: 1, Format: "Carousel", Title: "J", Caption: "c", Media: ["1.png", "2.png"], Status: "ready" }]), "json");
  const plan = planCalendarImport(recs, OPTS);
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.posts[0].data.mediaPaths, ["1.png", "2.png"]);
  assert.equal(plan.posts[0].data.status, "READY");
  assert.throws(() => readCalendar('{"day":1}', "json"));
});

test("the shipped example calendar parses cleanly", () => {
  const text = readFileSync(new URL("../scripts/content-calendar.example.csv", import.meta.url), "utf8");
  const plan = planCalendarImport(readCalendar(text, "csv"), OPTS);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.posts.length, 2);
});

function fakeStore(existing: string[] = []) {
  const keys = new Set(existing);
  const created: { sourceKey: string; status: string; createdByName: string }[] = [];
  const store: ImportStore = {
    existingKeys: async (ks) => ks.filter((k) => keys.has(k)),
    createMany: async (rows) => {
      let n = 0;
      for (const r of rows) if (!keys.has(r.sourceKey)) { keys.add(r.sourceKey); created.push(r); n++; }
      return n;
    },
  };
  return { store, created };
}

test("apply: creates only new keys, re-running changes nothing, errors block everything", async () => {
  const plan = planCalendarImport(csv("1,,Reel,A,,,,,,\n2,,Reel,B,,,,,,"), OPTS);
  const { store, created } = fakeStore(["ibda3-30d:day-01-reel"]);
  const first = await applyCalendarImport(store, plan, "Importer");
  assert.equal(first.created, 1);
  assert.deepEqual(first.skipped, ["ibda3-30d:day-01-reel"]);
  assert.equal(created[0].createdByName, "Importer");

  const again = await applyCalendarImport(store, plan, "Importer");
  assert.equal(again.created, 0);
  assert.equal(again.skipped.length, 2);

  const broken = planCalendarImport(csv("1,,Nope,A,,,,,,"), OPTS);
  await assert.rejects(applyCalendarImport(store, broken, "Importer"), /errors/);
});
