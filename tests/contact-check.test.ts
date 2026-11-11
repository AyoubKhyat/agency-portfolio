/**
 * A person's check of a prospect's WhatsApp/Instagram: honest statuses, an audit row for every check, no probes,
 * and send paths that only trust VERIFIED.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contactCheckActivity, contactOpenUrl, lastContactCheck } from "../src/lib/contact-check";
import { hasVerifiedChannel } from "../src/lib/prospect-stages";

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("each check is recorded with what was seen, before and after", () => {
  assert.deepEqual(contactCheckActivity("INSTAGRAM", "UNVERIFIED", "UNAVAILABLE"), {
    actionType: "UNAVAILABLE_INSTAGRAM", previousStatus: "UNVERIFIED", newStatus: "UNAVAILABLE", details: "Instagram: opened: not usable",
  });
  assert.equal(contactCheckActivity("WHATSAPP", null, "VERIFIED").actionType, "CONFIRMED_WHATSAPP");
  assert.equal(contactCheckActivity("WHATSAPP", "VERIFIED", "UNVERIFIED").details, "WhatsApp: check cleared");
});

test("the latest check of the right channel gives who and when", () => {
  const acts = [
    { actionType: "CONFIRMED_INSTAGRAM", userName: "Sara", createdAt: "2026-11-01T10:00:00Z", newStatus: "VERIFIED" },
    { actionType: "UNAVAILABLE_INSTAGRAM", userName: "Ayoub", createdAt: "2026-11-11T09:00:00Z", newStatus: "UNAVAILABLE" },
    { actionType: "CONFIRMED_WHATSAPP", userName: "Omar", createdAt: "2026-11-12T09:00:00Z", newStatus: "VERIFIED" },
    { actionType: "NOTE_ADDED", userName: "X", createdAt: "2026-11-13T09:00:00Z" },
  ];
  assert.deepEqual(lastContactCheck(acts, "INSTAGRAM"), { userName: "Ayoub", at: "2026-11-11T09:00:00.000Z", status: "UNAVAILABLE" });
  assert.equal(lastContactCheck(acts, "WHATSAPP")?.userName, "Omar");
  assert.equal(lastContactCheck([], "WHATSAPP"), null);
});

test("only rebuilt wa.me / instagram.com addresses are opened", () => {
  assert.equal(contactOpenUrl("INSTAGRAM", "@riadlaziza"), "https://www.instagram.com/riadlaziza/");
  assert.equal(contactOpenUrl("INSTAGRAM", "bad handle/../x"), null);
  assert.equal(contactOpenUrl("WHATSAPP", "https://wa.me/212625461645"), "https://wa.me/212625461645");
  for (const bad of ["0625461645", "javascript:alert(1)", "http://wa.me/212625461645", "https://wa.me.evil.com/1", "https://evil.com/wa.me"]) {
    assert.equal(contactOpenUrl("WHATSAPP", bad), null, bad);
  }
});

test("FOUND_ON_SITE and UNAVAILABLE are never treated as verified", () => {
  for (const s of ["FOUND_ON_SITE", "UNAVAILABLE", "UNVERIFIED"]) {
    assert.equal(hasVerifiedChannel({ whatsappStatus: s, instagramStatus: s }), false, s);
  }
  assert.equal(hasVerifiedChannel({ whatsappStatus: "VERIFIED", instagramStatus: "UNAVAILABLE" }), true);
  // The API accepts only the three person-set statuses; FOUND_ON_SITE can't be stored on a prospect.
  const route = read("src/app/api/admin/prospecting/[id]/route.ts");
  assert.match(route, /whatsappStatus: z\.enum\(\["UNVERIFIED", "VERIFIED", "UNAVAILABLE"\]\)/);
  assert.doesNotMatch(route, /FOUND_ON_SITE/);
  assert.match(route, /contactCheckActivity\("WHATSAPP", current\.whatsappStatus/);
  assert.match(route, /contactCheckActivity\("INSTAGRAM", current\.instagramStatus/);
  // Send buttons on the prospect list only open a channel a person marked VERIFIED.
  const list = read("src/app/admin/prospecting/page.tsx");
  assert.match(list, /if \(p\.whatsappStatus !== "VERIFIED"\)/);
  assert.match(list, /if \(p\.instagramStatus !== "VERIFIED"\)/);
});

test("no automated probe of Instagram or WhatsApp", () => {
  for (const f of ["src/lib/contact-check.ts", "src/components/admin/contact-check.tsx"]) {
    assert.doesNotMatch(read(f), /\bfetch\(|safeFetch|auditWebsite|prisma/, f);
  }
});

test("no shortcut marks a contact VERIFIED: every place uses the open-then-check row", () => {
  for (const f of ["src/components/admin/prospect-drawer.tsx", "src/app/admin/prospecting/[id]/page.tsx"]) {
    const src = read(f);
    assert.doesNotMatch(src, /setChannelStatus\("(whatsappStatus|instagramStatus)", "VERIFIED"\)/, `${f}: no one-click confirm`);
    assert.doesNotMatch(src, /(whatsappStatus|instagramStatus): "VERIFIED"/, `${f}: no hard-coded VERIFIED`);
    assert.match(src, /<ContactCheck channel="WHATSAPP"/, f);
    assert.match(src, /<ContactCheck channel="INSTAGRAM"/, f);
    assert.match(src, /\.\.\.CONTACT_CHECK_LABELS/, `${f}: checks read clearly in the history`);
  }
  assert.match(read("src/components/admin/prospect-drawer.tsx"), /onClick=\{goToContactChecks\}/, "the header icons only lead to the check");
});
