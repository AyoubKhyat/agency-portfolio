/**
 * Consent-aware analytics and WhatsApp messages: nothing is sent before
 * consent, only non-personal parameters are ever sent, page types and locales
 * are derived from the URL, double interactions count once, and every
 * contextual WhatsApp message exists in FR/EN/AR and encodes safely.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  canTrack,
  createClickDeduper,
  localeFromPath,
  pageTypeFromPath,
  sanitizeParams,
  trackEvent,
  type AnalyticsEnv,
} from "../src/lib/analytics";
import { buildWhatsAppUrl } from "../src/lib/whatsapp";

function env(over: Partial<AnalyticsEnv> = {}) {
  const calls: unknown[][] = [];
  const e: AnalyticsEnv = { gtag: (...a: unknown[]) => calls.push(a), consent: "accepted", disabled: false, ...over };
  return { e, calls };
}

test("no event before consent, after decline, when GA is disabled, or without gtag", () => {
  for (const over of [{ consent: null }, { consent: "declined" }, { disabled: true }, { gtag: undefined }] as Partial<AnalyticsEnv>[]) {
    const { e, calls } = env(over);
    assert.equal(canTrack(e), false);
    assert.equal(trackEvent("generate_lead", { method: "contact_form" }, e), false);
    assert.equal(calls.length, 0, JSON.stringify(over));
  }
  assert.equal(trackEvent("whatsapp_click", {}, null), false); // server / no window
});

test("with consent, the event is sent with sanitized parameters", () => {
  const { e, calls } = env();
  assert.equal(trackEvent("generate_lead", { method: "contact_form", service: "video-editing", locale: "fr", page_type: "contact" }, e), true);
  assert.deepEqual(calls, [["event", "generate_lead", { method: "contact_form", service: "video-editing", locale: "fr", page_type: "contact" }]]);
});

test("personal data can never reach analytics", () => {
  const out = sanitizeParams({
    service: "visitor@example.com",
    placement: "+212625461645",
    locale: "Jean Dupont",
    page_type: "Bonjour, je voudrais un site",
    method: "212625461645",
    // @ts-expect-error unknown keys are dropped
    email: "visitor@example.com",
  });
  assert.deepEqual(out, {});
  assert.deepEqual(sanitizeParams({ placement: "Home_Hero", service: null, locale: undefined }), { placement: "home_hero" });
});

test("page type and locale come from the path", () => {
  const cases: [string, string, string][] = [
    ["/fr", "home", "fr"],
    ["/ar/services", "services", "ar"],
    ["/en/services/web", "service_detail", "en"],
    ["/fr/portfolio", "portfolio", "fr"],
    ["/fr/portfolio/dandana-cabaret", "case_study", "fr"],
    ["/en/contact", "contact", "en"],
    ["/fr/about", "about", "fr"],
    ["/fr/blog/seo-visible-google-marrakech", "blog_post", "fr"],
    ["/fr/privacy", "privacy", "fr"],
    ["/admin", "other", "other"],
  ];
  for (const [path, type, loc] of cases) {
    assert.equal(pageTypeFromPath(path), type, path);
    assert.equal(localeFromPath(path), loc, path);
  }
});

test("a double click on one WhatsApp link counts once; separate clicks count", () => {
  let now = 1000;
  const fresh = createClickDeduper(1000, () => now);
  const link = {};
  const other = {};
  assert.equal(fresh(link), true);
  now += 200;
  assert.equal(fresh(link), false); // dblclick / click + auxclick
  assert.equal(fresh(other), true); // a different link
  now += 1500;
  assert.equal(fresh(link), true); // a later, deliberate click
});

const msgs = Object.fromEntries(["fr", "en", "ar"].map((l) => [l, JSON.parse(fs.readFileSync(`src/messages/${l}.json`, "utf8"))]));

test("contextual WhatsApp messages exist in FR/EN/AR with their placeholders", () => {
  for (const l of ["fr", "en", "ar"]) {
    const wa = msgs[l].WhatsApp;
    for (const k of ["prefill_general", "prefill_contact", "prefill_case_study", "prefill_service", "prefill_message"]) {
      assert.ok(typeof wa[k] === "string" && wa[k].length > 15, `${l}.${k}`);
    }
    assert.match(wa.prefill_case_study, /\{project\}/, `${l} case study`);
    assert.match(wa.prefill_service, /\{service\}/, `${l} service`);
    if (l === "ar") assert.match(wa.prefill_service, /[؀-ۿ]/);
  }
});

test("WhatsApp URLs encode contextual messages safely", () => {
  const ar = msgs.ar.WhatsApp.prefill_service.replace("{service}", "مونتاج الريلز");
  const url = buildWhatsAppUrl(ar);
  assert.match(url, /^https:\/\/wa\.me\/212625461645\?text=/);
  assert.equal(decodeURIComponent(url.split("?text=")[1]), ar);
  const fr = msgs.fr.WhatsApp.prefill_case_study.replace("{project}", "Dandana Cabaret & Co");
  assert.equal(decodeURIComponent(buildWhatsAppUrl(fr).split("?text=")[1]), fr); // & and ' survive
  assert.equal(buildWhatsAppUrl(), "https://wa.me/212625461645");
});
