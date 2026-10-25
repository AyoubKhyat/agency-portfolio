/**
 * Homepage free-diagnosis requests: URL rules, the two-step validation, the
 * lead payload, the shared submission path (lib/contact-submit) and the real
 * /api/contact route end to end. Data access, notifications and webhooks are
 * mocked: no database, no email, nothing fetched from the visitor's site.
 * Needs --experimental-test-module-mocks (see the "test" script).
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  DIAGNOSIS_SUBJECT,
  EMPTY_DIAGNOSIS,
  PROBLEM_MAX,
  SITE_URL_FIELD,
  buildDiagnosisInquiry,
  normalizeSiteUrl,
  validateDiagnosisField,
  validateStep,
} from "../src/lib/diagnosis";
import { submitInquiry, type EmailJsConfig, type Inquiry } from "../src/lib/contact-submit";

// ─── Site address ────────────────────────────────────────────────

test("site address: bare domains get https://, real URLs are kept", () => {
  assert.equal(normalizeSiteUrl("votresite.ma"), "https://votresite.ma");
  assert.equal(normalizeSiteUrl("  www.Example.com  "), "https://www.example.com");
  assert.equal(normalizeSiteUrl("http://riad-nour.ma/fr/contact?x=1"), "http://riad-nour.ma/fr/contact?x=1");
  assert.equal(normalizeSiteUrl("https://shop.example.co.uk/"), "https://shop.example.co.uk");
  assert.equal(normalizeSiteUrl("https://café.ma"), "https://xn--caf-dma.ma", "internationalised domains");
});

test("site address: anything that is not a public http(s) website is refused", () => {
  const bad = [
    "", "   ", "hello", "localhost", "http://localhost:3000", "192.168.1.1", "ftp://example.com",
    "javascript:alert(1)", "mailto:a@b.ma", "https://user:pass@example.com", "exa mple.com",
    "https://example", "https://-bad-.com", "https://example.c", `https://${"a".repeat(300)}.com`,
  ];
  for (const v of bad) assert.equal(normalizeSiteUrl(v), null, JSON.stringify(v));
});

// ─── Two steps ───────────────────────────────────────────────────

test("step 1 needs only a valid site address", () => {
  assert.deepEqual(validateStep(1, EMPTY_DIAGNOSIS), { siteUrl: "url_required" });
  assert.deepEqual(validateStep(1, { ...EMPTY_DIAGNOSIS, siteUrl: "not a site" }), { siteUrl: "url_invalid" });
  // Step 2 fields do not block step 1.
  assert.deepEqual(validateStep(1, { ...EMPTY_DIAGNOSIS, siteUrl: "example.ma" }), {});
});

test("step 2: name and email required, phone and problem optional", () => {
  const base = { ...EMPTY_DIAGNOSIS, siteUrl: "example.ma" };
  assert.deepEqual(validateStep(2, base), { fullName: "name_required", email: "email_required" });
  assert.deepEqual(validateStep(2, { ...base, fullName: "A", email: "nope" }), { fullName: "name_min", email: "email_invalid" });
  assert.deepEqual(validateStep(2, { ...base, fullName: "Sara", email: "sara@example.ma" }), {}, "phone and problem may stay empty");
  assert.deepEqual(validateStep(2, { ...base, fullName: "Sara", email: "sara@example.ma", phone: "abc" }), { phone: "phone_invalid" });
  assert.equal(validateDiagnosisField("phone", "+212 6 25 46 16 45"), undefined);
  assert.equal(validateDiagnosisField("problem", ""), undefined);
});

// ─── Lead payload ────────────────────────────────────────────────

const request = { siteUrl: "riad-nour.ma", fullName: " Sara B ", email: " sara@example.ma ", phone: "", problem: "", locale: "ar" };

test("payload: fixed subject, site + locale in the message, optional fields omitted", () => {
  const inq = buildDiagnosisInquiry(request);
  assert.equal(inq.subject, DIAGNOSIS_SUBJECT);
  assert.equal(inq.subject, "Diagnostic gratuit");
  assert.equal(inq.fullName, "Sara B");
  assert.equal(inq.email, "sara@example.ma");
  assert.equal(inq.phone, undefined);
  assert.match(inq.message, /^Site : https:\/\/riad-nour\.ma$/m);
  assert.match(inq.message, /^Langue : AR$/m);
  assert.match(inq.message, /^Problème décrit : non précisé$/m);
  assert.ok(inq.message.length >= 10, "passes the API's 10-character minimum without a problem description");
});

test("payload: the problem description is kept (trimmed, capped) and the phone passed on", () => {
  const inq = buildDiagnosisInquiry({ ...request, phone: " +212 625 461 645 ", problem: "  Le formulaire n'envoie rien.  " });
  assert.equal(inq.phone, "+212 625 461 645");
  assert.match(inq.message, /^Problème décrit : Le formulaire n'envoie rien\.$/m);
  const long = buildDiagnosisInquiry({ ...request, problem: "x".repeat(PROBLEM_MAX + 500) });
  assert.ok(long.message.length < 5000, "always within the API's 5000-character limit");
  assert.throws(() => buildDiagnosisInquiry({ ...request, siteUrl: "nope" }));
});

test("honeypot isolation: the URL field is siteUrl, and the payload never carries `website`", () => {
  assert.equal(SITE_URL_FIELD, "siteUrl");
  assert.notEqual(SITE_URL_FIELD, "website");
  const inq = buildDiagnosisInquiry(request) as Record<string, unknown>;
  assert.equal("website" in inq, false);
  assert.equal("siteUrl" in inq, false, "the address travels inside the message, not as a field");
  assert.deepEqual(Object.keys(inq).sort(), ["email", "fullName", "message", "phone", "subject"]);
});

// ─── Shared submission path (fake fetch) ─────────────────────────

const CONFIG: EmailJsConfig = { serviceId: "svc", templateId: "tpl", publicKey: "pk" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fakeFetch(answer: Response | Error) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
    if (url === "/api/contact/notification-status") return new Response(null, { status: 204 });
    if (answer instanceof Error) throw answer;
    return answer.clone();
  }) as unknown as typeof fetch;
  return { fn, calls };
}

test("submit: saved + emailed is a success, counted once, with the exact contact-form params", async () => {
  const { fn, calls } = fakeFetch(json(201, { success: true, stored: true, duplicate: false, leadId: "lead123456789012345678901" }));
  const sent: EmailJsConfig[] = [];
  const inq = buildDiagnosisInquiry(request);
  const r = await submitInquiry(inq, async (cfg) => { sent.push(cfg); }, { fetch: fn, config: CONFIG });
  assert.deepEqual([r.outcome, r.email, r.track], ["success", "sent", true]);
  assert.deepEqual(sent, [CONFIG]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/contact");
  assert.deepEqual(Object.keys(calls[0].body).sort(), ["email", "fullName", "message", "subject"], "no phone when empty, never `website`");
});

test("submit: a failed request is never reported as success", async () => {
  // Server/database failure and the email also fails: error.
  let r = await submitInquiry(buildDiagnosisInquiry(request), async () => { throw new Error("emailjs down"); }, { fetch: fakeFetch(json(503, { stored: false })).fn, config: CONFIG });
  assert.deepEqual([r.outcome, r.track], ["error", false]);
  // Network error, no EmailJS configured: error.
  r = await submitInquiry(buildDiagnosisInquiry(request), async () => {}, { fetch: fakeFetch(new Error("offline")).fn, config: null });
  assert.deepEqual([r.outcome, r.email], ["error", "not_configured"]);
  // Rate limited: no email, not counted.
  const sent: unknown[] = [];
  r = await submitInquiry(buildDiagnosisInquiry(request), async (c) => { sent.push(c); }, { fetch: fakeFetch(json(429, {})).fn, config: CONFIG });
  assert.deepEqual([r.outcome, r.email, r.track, sent.length], ["rate_limited", "skipped", false, 0]);
  // Rejected by validation: error, no email.
  r = await submitInquiry(buildDiagnosisInquiry(request), async (c) => { sent.push(c); }, { fetch: fakeFetch(json(400, {})).fn, config: CONFIG });
  assert.deepEqual([r.outcome, sent.length], ["error", 0]);
});

test("submit: not saved but emailed tells the visitor it was only emailed", async () => {
  const r = await submitInquiry(buildDiagnosisInquiry(request), async () => {}, { fetch: fakeFetch(json(503, { stored: false })).fn, config: CONFIG });
  assert.deepEqual([r.outcome, r.track], ["email_only", true]);
});

test("submit: saved but the email failed is still a success, and the server is told", async () => {
  const { fn, calls } = fakeFetch(json(201, { stored: true, duplicate: false, leadId: "lead123456789012345678901" }));
  const r = await submitInquiry(buildDiagnosisInquiry(request), async () => { throw new Error("quota"); }, { fetch: fn, config: CONFIG });
  assert.equal(r.outcome, "success");
  assert.deepEqual(calls.map((c) => c.url), ["/api/contact", "/api/contact/notification-status"]);
  assert.deepEqual(calls[1].body, { leadId: "lead123456789012345678901", status: "failed" });
});

test("submit: a duplicate is acknowledged without a second email or analytics event", async () => {
  const sent: unknown[] = [];
  const r = await submitInquiry(buildDiagnosisInquiry(request), async (c) => { sent.push(c); }, { fetch: fakeFetch(json(200, { stored: true, duplicate: true, leadId: null })).fn, config: CONFIG });
  assert.deepEqual([r.outcome, r.track, sent.length], ["success", false, 0]);
});

// ─── End to end through the real /api/contact route ─────────────

const db = { leads: [] as Record<string, unknown>[], notified: [] as string[], webhooks: [] as string[] };
mock.module("@/lib/dal", {
  namedExports: {
    getLeastLoadedUser: async () => ({ id: "u1", fullName: "Sales" }),
    findRecentDuplicateLead: async (email: string, message: string, subject: string) =>
      (db.leads.find((l) => l.email === email && l.message === message && l.subject === subject)?.id as string) ?? null,
    createLead: async (data: Record<string, unknown>) => {
      const lead = { ...data, id: `lead${db.leads.length + 1}xxxxxxxxxxxxxxxxxxxx` };
      db.leads.push(lead);
      return lead;
    },
  },
});
mock.module("@/lib/notify", { namedExports: { notifyNewLead: async (l: { id: string }) => { db.notified.push(l.id); return 1; } } });
mock.module("@/lib/webhooks", { namedExports: { dispatchWebhook: (event: string) => { db.webhooks.push(event); } } });

const route = import("../src/app/api/contact/route");
let ip = 0;
const viaRoute = (async (url: string, init?: RequestInit) => {
  assert.equal(url, "/api/contact");
  const headers = { ...(init?.headers as Record<string, string>), "x-forwarded-for": `10.9.0.${++ip}` };
  return (await route).POST(new Request(`http://x${url}`, { ...init, headers }));
}) as unknown as typeof fetch;

test("end to end: a diagnosis request becomes one assigned, notified CRM lead", async () => {
  db.leads = []; db.notified = []; db.webhooks = [];
  const emailed: Inquiry[] = [];
  const inq = buildDiagnosisInquiry({ ...request, problem: "Le site est lent sur mobile." });
  const r = await submitInquiry(inq, async () => { emailed.push(inq); }, { fetch: viaRoute, config: CONFIG });
  assert.deepEqual([r.outcome, r.track], ["success", true]);
  assert.equal(db.leads.length, 1);
  const lead = db.leads[0];
  assert.equal(lead.subject, "Diagnostic gratuit");
  assert.equal(lead.assignedToId, "u1");
  assert.match(String(lead.message), /https:\/\/riad-nour\.ma/);
  assert.match(String(lead.message), /Le site est lent sur mobile\./);
  assert.deepEqual(db.notified, [lead.id]);
  assert.deepEqual(db.webhooks, ["lead.new"]);
  assert.equal(emailed.length, 1);

  // The same request again within the window: duplicate, nothing new.
  const again = await submitInquiry(inq, async () => { emailed.push(inq); }, { fetch: viaRoute, config: CONFIG });
  assert.deepEqual([again.outcome, again.track], ["success", false]);
  assert.equal(db.leads.length, 1);
  assert.equal(emailed.length, 1);
});

test("end to end: the honeypot is the only thing that silently drops a request", async () => {
  db.leads = [];
  const inq = buildDiagnosisInquiry(request);
  // A real diagnosis payload is stored even though it contains a website address...
  assert.equal((await (await route).POST(new Request("http://x/api/contact", { method: "POST", headers: { "x-forwarded-for": "10.8.0.1" }, body: JSON.stringify(inq) }))).status, 201);
  // ...while a bot filling `website` gets a quiet 200 and nothing is saved.
  const bot = await (await route).POST(new Request("http://x/api/contact", { method: "POST", headers: { "x-forwarded-for": "10.8.0.2" }, body: JSON.stringify({ ...inq, website: "https://spam.example" }) }));
  assert.equal(bot.status, 200);
  assert.equal(db.leads.length, 1);
});
