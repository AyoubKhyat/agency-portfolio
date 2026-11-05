/**
 * A draft is only required to mention a name when its greeting used one. Runs the real approval code with
 * the database faked: no database, network or AI.
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let lead: { id: string; fullName: string; phone: string | null };
let updates: any[] = [];

let mod: typeof import("../src/lib/ai-workforce/inbound-diagnosis");
let greeting: typeof import("../src/lib/ai-workforce/greeting");

before(async () => {
  mock.module("@/lib/prisma", {
    namedExports: {
      hasPrisma: () => true,
      prisma: {
        lead: { findUnique: async () => lead },
        aiRun: {
          findFirst: async () => ({ id: "run-1", leadId: lead.id, status: "DRAFT_READY" }),
          updateMany: async (args: any) => { updates.push(args); return { count: 1 }; },
        },
      },
    },
  });
  mock.module("@/lib/audit", { namedExports: { getClientIp: () => "127.0.0.1", logAudit: async () => {} } });
  mod = await import("../src/lib/ai-workforce/inbound-diagnosis");
  greeting = await import("../src/lib/ai-workforce/greeting");
});
beforeEach(() => { updates = []; });

const actor = { userId: "u1", fullName: "Team" };
/** The unedited draft, put together the way a run does it. */
const draftFor = (fullName: string, language: "fr" | "en" | "ar" = "fr") =>
  `${mod.greetingFor(language, fullName)}\n\nSur riad-atlas.ma, la page n'a pas de description.\n\n${mod.LIMITATION_NOTE[language]}\n\n${mod.SIGN_OFF[language]}`;
const approve = (fullName: string, body: string) => {
  lead = { id: "lead-1", fullName, phone: "0612345678" };
  return mod.applyRunAction("lead-1", "run-1", { action: "approve", subject: "Votre site", body, channel: "EMAIL" }, actor);
};

const NEUTRAL: [string, string][] = [
  ["short first word", "El Mehdi Alaoui"],
  ["title with a dot", "Dr. Sara Bennani"],
  ["title without a dot", "Dr Sara Bennani"],
  ["URL as a name", "https://evil.example/pay now"],
  ["French title", "Mme Bennani"],
  ["particle", "Ben Salah Youssef"],
  ["Arabic title", "الدكتور سارة بناني"],
  ["Arabic short word", "بن سعيد"],
];

for (const [label, fullName] of NEUTRAL) {
  test(`${label} "${fullName}": neutral greeting, and the unedited draft can be approved`, async () => {
    const body = draftFor(fullName);
    assert.match(body, /^Bonjour,\n/);
    assert.deepEqual(await approve(fullName, body), { ok: true, status: "APPROVED" });
    assert.equal(updates.length, 1, "the approval was written");
    assert.equal(updates[0].data.approvedBody, body);
  });
}

test("no neutral greeting leaks any part of a URL typed as a name", () => {
  assert.doesNotMatch(draftFor("https://evil.example/pay now"), /evil|https?:/);
});

for (const [fullName, first, opening] of [
  ["Sara Bennani", "Sara", "Bonjour Sara,"],
  ["Mehdi Alaoui", "Mehdi", "Bonjour Mehdi,"],
  ["Mohamed El Amine", "Mohamed", "Bonjour Mohamed,"],
  ["Jean-Marc O'Neil", "Jean-Marc", "Bonjour Jean-Marc,"],
  ["El-Mehdi Alaoui", "El-Mehdi", "Bonjour El-Mehdi,"],
  ["سارة بناني", "سارة", "Bonjour سارة,"],
] as const) {
  test(`ordinary name "${fullName}": greeted by first name, and the draft must keep it`, async () => {
    assert.equal(greeting.firstNameFrom(fullName), first);
    const body = draftFor(fullName);
    assert.ok(body.startsWith(opening), body);
    assert.deepEqual(await approve(fullName, body), { ok: true, status: "APPROVED" });

    updates = [];
    const edited = body.replace(`${first}`, "cher client");
    const refused: any = await approve(fullName, edited);
    assert.equal(refused.ok, false);
    assert.equal(refused.code, "quality");
    assert.deepEqual(refused.detail, ["Missing business name"]);
    assert.equal(updates.length, 0, "nothing written");
  });
}

test("the greeting, the server check and the panel all make the same decision", () => {
  const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
  assert.match(read("src/lib/ai-workforce/inbound-diagnosis.ts"), /analyzeMessage\(input\.body, \{ name: requiredDraftName\(lead\.fullName\) \}\)/);
  assert.match(read("src/components/admin/diagnosis-panel.tsx"), /analyzeMessage\(body, \{ name: requiredDraftName\(fullName\) \}\)/);
  assert.doesNotMatch(read("src/lib/ai-workforce/greeting.ts"), /from "@\/lib\/(prisma|audit)"/, "the panel runs this in the browser");
});
