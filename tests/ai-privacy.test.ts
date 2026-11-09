/**
 * P5A privacy: retention boundaries, the field classification, the script guards, the FR/EN/AR disclosures
 * and the diagnosis form notice. No database: the database behaviour is in tests/ai-retention-db.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Prisma } from "@prisma/client";
import {
  CONTENT_RETENTION_DAYS,
  REDACTED_CONTENT_FIELDS,
  REDACTED_WORDING_FIELDS,
  RETAINED_FIELDS,
  checkMaintenanceDb,
  monthsBefore,
  retentionCutoffs,
} from "../src/lib/ai-workforce/retention";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const DAY = 24 * 60 * 60 * 1000;

/* ───────── Boundaries ───────── */

test("content is due strictly after 90 days", () => {
  const now = new Date("2026-11-09T10:00:00.000Z");
  assert.equal(CONTENT_RETENTION_DAYS, 90);
  assert.equal(now.getTime() - retentionCutoffs(now).content.getTime(), 90 * DAY);
});

test("SENT wording is due after 12 calendar months, with month ends clamped", () => {
  assert.equal(monthsBefore(new Date("2026-11-09T10:00:00.000Z"), 12).toISOString(), "2025-11-09T10:00:00.000Z");
  assert.equal(monthsBefore(new Date("2028-02-29T12:00:00.000Z"), 12).toISOString(), "2027-02-28T12:00:00.000Z");
  assert.equal(monthsBefore(new Date("2027-03-31T00:00:00.000Z"), 1).toISOString(), "2027-02-28T00:00:00.000Z");
  assert.equal(monthsBefore(new Date("2027-01-15T08:30:00.000Z"), 12).toISOString(), "2026-01-15T08:30:00.000Z");
  assert.equal(retentionCutoffs(new Date("2026-11-09T10:00:00.000Z")).sentWording.toISOString(), "2025-11-09T10:00:00.000Z");
});

/* ───────── What is kept ───────── */

test("every ai_runs column is classified exactly once", () => {
  const columns = Object.keys(Prisma.AiRunScalarFieldEnum).sort();
  const classified = [...REDACTED_CONTENT_FIELDS, ...REDACTED_WORDING_FIELDS, ...RETAINED_FIELDS];
  assert.equal(new Set(classified).size, classified.length, "a column is listed twice");
  assert.deepEqual([...classified].sort(), columns, "a new ai_runs column must be classified as cleared or kept");
});

test("nothing about the enquirer or their site is kept", () => {
  const personal = ["targetUrl", "finalUrl", "evidence", "findings", "gapScore", "fitLabel", "duplicateStatus", "duplicateReason",
    "duplicateProspectId", "draftSubject", "draftBody", "approvedSubject", "approvedBody", "errorDetail"];
  for (const f of personal) assert.ok(!(RETAINED_FIELDS as readonly string[]).includes(f), `${f} must not be retained`);
});

/* ───────── Script guards ───────── */

test("scripts only use a local database unless the exact host is allowed", () => {
  assert.equal(checkMaintenanceDb("").ok, false);
  assert.equal(checkMaintenanceDb("not a url").ok, false);
  assert.deepEqual(checkMaintenanceDb("postgresql://u:p@127.0.0.1:5432/db"), { ok: true, host: "127.0.0.1", remote: false });
  const remote = "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/db";
  assert.equal(checkMaintenanceDb(remote).ok, false);
  assert.equal(checkMaintenanceDb(remote, "other.neon.tech").ok, false);
  assert.deepEqual(checkMaintenanceDb(remote, "ep-x.eu-central-1.aws.neon.tech"), { ok: true, host: "ep-x.eu-central-1.aws.neon.tech", remote: true });
});

/** Runs a script with a clean environment: no DATABASE_URL, so nothing could reach a real database. */
function runScript(script: string, args: string[], env: Record<string, string> = {}) {
  const { DATABASE_URL: _drop, ...rest } = process.env;
  void _drop;
  return spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    cwd: new URL("..", import.meta.url), env: { ...rest, AI_PRIVACY_DATABASE_URL: "", OWNER_USER_ID: "", ...env }, encoding: "utf8", timeout: 60_000,
  });
}

test("the retention script refuses to run without a database or against an unapproved remote host", () => {
  const none = runScript("scripts/redact-ai-runs.ts", []);
  assert.equal(none.status, 1);
  assert.match(none.stderr, /never read DATABASE_URL/);
  const remote = runScript("scripts/redact-ai-runs.ts", ["--apply"], { AI_PRIVACY_DATABASE_URL: "postgresql://u:p@ep-x.neon.tech/db" });
  assert.equal(remote.status, 1);
  assert.match(remote.stderr, /refusing non-local database host/);
  const typo = runScript("scripts/redact-ai-runs.ts", ["--aply"]);
  assert.equal(typo.status, 1);
  assert.match(typo.stderr, /unknown option/);
});

test("the erasure script needs a lead and an owner email before touching anything", () => {
  const noLead = runScript("scripts/erase-lead.ts", ["--owner", "o@example.com"]);
  assert.equal(noLead.status, 1);
  assert.match(noLead.stderr, /--lead <leadId> is required/);
  const noOwner = runScript("scripts/erase-lead.ts", ["--lead", "abc"]);
  assert.equal(noOwner.status, 1);
  assert.match(noOwner.stderr, /--owner <owner email> is required/);
  const remote = runScript("scripts/erase-lead.ts", ["--lead", "abc", "--owner", "o@example.com", "--apply"], { AI_PRIVACY_DATABASE_URL: "postgresql://u:p@ep-x.neon.tech/db" });
  assert.equal(remote.status, 1);
  assert.match(remote.stderr, /refusing non-local database host/);
});

test("both scripts are dry runs unless --apply is passed", () => {
  for (const file of ["scripts/redact-ai-runs.ts", "scripts/erase-lead.ts"]) {
    const src = read(file);
    assert.match(src, /DRY RUN BY DEFAULT/);
    assert.match(src, /apply = (argv\.includes\("--apply"\)|opts\.apply === true)/);
    assert.ok(!/process\.env\.DATABASE_URL/.test(src), `${file} must not read DATABASE_URL`);
  }
});

/* ───────── Disclosures ───────── */

type Section = { h: string; p?: string[]; items?: string[]; consent?: boolean };
const messages = Object.fromEntries((["fr", "en", "ar"] as const).map((l) => [l, JSON.parse(read(`src/messages/${l}.json`))]));
const AI_WORDS = { fr: /intelligence artificielle/, en: /artificial intelligence/, ar: /ذكاء اصطناعي/ };

test("the privacy policy has the same shape in FR, EN and AR", () => {
  const shape = (s: Section[]) => s.map((x) => ({ p: x.p?.length ?? 0, items: x.items?.length ?? 0, consent: !!x.consent }));
  const fr = messages.fr.Privacy.sections as Section[];
  assert.equal(fr.length, 6);
  for (const l of ["en", "ar"]) assert.deepEqual(shape(messages[l].Privacy.sections), shape(fr), `${l} differs from fr`);
});

test("each locale discloses Groq, what it receives, human review and the retention periods", () => {
  for (const l of ["fr", "en", "ar"] as const) {
    const all = (messages[l].Privacy.sections as Section[]).flatMap((s) => [...(s.p ?? []), ...(s.items ?? [])]).join("\n");
    assert.match(all, /Groq, Inc\./, `${l}: Groq not named`);
    assert.match(all, AI_WORDS[l], `${l}: AI not named`);
    assert.match(all, /90/, `${l}: 90-day period missing`);
    assert.match(all, /12/, `${l}: 12-month period missing`);
    assert.match(messages[l].Privacy.updated, /2026/);
  }
});

test("the diagnosis form says AI is used and links the privacy policy in every locale", () => {
  const keys = Object.keys(messages.fr.Diagnosis);
  for (const l of ["fr", "en", "ar"] as const) {
    const d = messages[l].Diagnosis;
    assert.deepEqual(Object.keys(d), keys, `${l}: Diagnosis keys differ from fr`);
    assert.match(d.note, AI_WORDS[l], `${l}: note doesn't mention AI`);
    assert.match(d.privacy_notice, /Groq/);
    assert.equal(d.privacy_notice.match(/<link>[^<]+<\/link>/g)?.length, 1, `${l}: privacy_notice needs exactly one <link>`);
  }
  const form = read("src/components/home-v2/DiagnosisForm.tsx");
  assert.match(form, /import \{ Link \} from "@\/i18n\/navigation"/, "the link must be locale-aware");
  assert.match(form, /t\.rich\("privacy_notice", \{ link: \(chunks\) => <Link href="\/privacy">\{chunks\}<\/Link> \}\)/);
});

test("the privacy policy is still an unapproved draft", () => {
  assert.match(read("src/app/[locale]/privacy/page.tsx"), /const PRIVACY_POLICY_APPROVED = false;/);
});

test("the admin panel doesn't pull the database layer into the browser", () => {
  const panel = read("src/components/admin/diagnosis-panel.tsx");
  assert.ok(!/ai-workforce\/retention"/.test(panel), "import retention-policy, not retention");
  assert.match(panel, /run\.status === "EXPIRED"/);
  assert.match(panel, /run\.targetUrl === ""/);
});

test("sent wording isn't copied into lead notes, and the policy doesn't claim a lasting copy", () => {
  const src = read("src/lib/ai-workforce/inbound-diagnosis.ts");
  const note = /tx\.leadNote\.create\(\{[\s\S]*?\}\);/.exec(src)?.[0] ?? "";
  assert.ok(note, "the delivery note is still recorded");
  assert.doesNotMatch(note, /approved(Body|Subject)|draft(Body|Subject)/, "the note must not hold the wording");
  for (const l of ["fr", "en", "ar"] as const) {
    const retention = JSON.stringify(messages[l].Privacy.sections[4]);
    assert.doesNotMatch(retention, /copie figure|a copy is also|توجد نسخة/, `${l}: no indefinite copy`);
  }
});

test("possible-copy matching normalises domains and phones the way duplicate detection does", async () => {
  const { hostKey, phoneKey, SHARED_HOSTS } = await import("../src/lib/ai-workforce/retention");
  assert.equal(hostKey("https://www.Riad-Example.ma/fr?x=1"), "riad-example.ma");
  assert.equal(hostKey("riad-example.ma"), "riad-example.ma");
  assert.equal(hostKey(""), null);
  assert.equal(hostKey("not a url"), null);
  assert.equal(hostKey("localhost"), null, "no bare hosts");
  assert.equal(phoneKey("+212 6 00-00-00-00"), "600000000");
  assert.equal(phoneKey("0600000000"), "600000000");
  assert.equal(phoneKey("https://wa.me/212600000000"), "600000000");
  assert.equal(phoneKey("12345"), null);
  for (const h of ["instagram.com", "facebook.com", "wa.me", "linktr.ee"]) assert.ok(SHARED_HOSTS.has(h));
});

test("the erasure paragraph covers separately stored records and exports without promising automatic deletion", () => {
  const words = {
    fr: [/fiches enregistrées séparément/, /au cas par cas/, /fichiers exportés/, /sauvegardes/],
    en: [/records stored separately/, /case by case/, /Exported files/, /backups/],
    ar: [/السجلات الأخرى المحفوظة بشكل منفصل/, /حالةً بحالة/, /ملفات التصدير/, /النسخ الاحتياطية/],
  } as const;
  for (const l of ["fr", "en", "ar"] as const) {
    const erasure = (messages[l].Privacy.sections[4] as Section).p?.[3] ?? "";
    for (const w of words[l]) assert.match(erasure, w, `${l}: missing ${w}`);
    assert.doesNotMatch(erasure, /automatiquement|automatically|تلقائي|آلياً/, `${l}: must not promise automatic deletion`);
  }
});

test("the erasure script reports possible copies before erasing and never deletes them", () => {
  const src = read("scripts/erase-lead.ts");
  const report = src.indexOf("findPossibleCopies(prisma, leadId)");
  assert.ok(report > 0 && report < src.indexOf("if (!apply)"), "the report runs in the dry run, before any erasure");
  assert.doesNotMatch(src, /prospect\.delete|client\.delete|chatMessage\.delete/);
  const lib = read("src/lib/ai-workforce/retention.ts");
  const fn = lib.slice(lib.indexOf("export async function findPossibleCopies"), lib.indexOf("/* ───────────────── Script safety"));
  assert.doesNotMatch(fn, /\.(delete|deleteMany|update|updateMany|create|upsert)\(/, "findPossibleCopies is read-only");
});
