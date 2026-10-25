/**
 * One service catalog for the whole site: homepage groups, Services page,
 * detail routes, footer, contact form, assistant and structured data all read
 * src/lib/services-catalog.ts. These tests keep the catalog, its FR/EN/AR copy,
 * its routes and the `?service=` contract consistent.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DETAIL_PAGE_IDS,
  SERVICE_GROUPS,
  SERVICES,
  contactHref,
  groupHref,
  isServiceId,
  parseServiceParam,
  serviceHref,
  servicesInGroup,
} from "../src/lib/services-catalog";
import { FEATURES, SERVICE_KEYS as COMPARISON_KEYS } from "../src/components/services-v2/data";
import { OPTIONS } from "../src/components/assistant/script";

const LOCALES = ["fr", "en", "ar"] as const;
const msgs = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(`src/messages/${l}.json`, "utf8"))]));

test("the approved architecture: 4 groups, 12 services, nothing removed", () => {
  assert.deepEqual(SERVICE_GROUPS.map((g) => g.id), ["web-digital", "growth", "support", "creative"]);
  assert.deepEqual(servicesInGroup("web-digital").map((s) => s.id), ["web", "ecommerce", "mobile", "booking", "automation", "ai"]);
  assert.deepEqual(servicesInGroup("growth").map((s) => s.id), ["seo"]);
  assert.deepEqual(servicesInGroup("support").map((s) => s.id), ["maintenance", "website-repair"]);
  assert.deepEqual(servicesInGroup("creative").map((s) => s.id), ["video-editing", "reels-editing", "graphic-design"]);
  assert.equal(SERVICES.length, 12);
  assert.equal(new Set(SERVICES.map((s) => s.id)).size, SERVICES.length, "ids are unique");
  assert.equal(new Set(SERVICES.map((s) => s.msg)).size, SERVICES.length, "message keys are unique");
});

test("six detail pages (the five existing + website repair); comparison table and sitemap follow them", () => {
  assert.deepEqual([...DETAIL_PAGE_IDS], ["web", "ecommerce", "mobile", "seo", "maintenance", "website-repair"]);
  assert.deepEqual([...COMPARISON_KEYS], [...DETAIL_PAGE_IDS]);
  for (const f of FEATURES) assert.equal(f.included.length, COMPARISON_KEYS.length, `comparison row ${f.key}`);
  const sitemap = fs.readFileSync("src/app/sitemap.ts", "utf8");
  assert.match(sitemap, /serviceSlugs = DETAIL_PAGE_IDS/);
  const detail = fs.readFileSync("src/app/[locale]/services/[slug]/page.tsx", "utf8");
  assert.match(detail, /const SLUGS = DETAIL_PAGE_IDS/);
});

test("links: detail page, Services-page anchor, group anchor, contact preselection", () => {
  assert.equal(serviceHref("web"), "/services/web");
  assert.equal(serviceHref("seo"), "/services/seo");
  assert.equal(serviceHref("maintenance"), "/services/maintenance", "existing URL kept");
  assert.equal(serviceHref("website-repair"), "/services/website-repair");
  assert.equal(groupHref("growth"), "/services#group-growth", "existing anchor kept");
  assert.equal(groupHref("support"), "/services#group-support");
  assert.equal(serviceHref("booking"), "/services#svc-booking");
  assert.equal(serviceHref("video-editing"), "/services#svc-video-editing");
  assert.equal(groupHref("creative"), "/services#group-creative");
  assert.equal(contactHref("reels-editing"), "/contact?service=reels-editing");
  for (const s of SERVICES) assert.match(serviceHref(s.id), /^\/services(\/[a-z-]+|#svc-[a-z-]+)$/);
});

test("?service= accepts only known ids, with a safe default (nothing preselected)", () => {
  assert.equal(parseServiceParam("video-editing"), "video-editing");
  assert.equal(parseServiceParam("  Video-Editing "), "video-editing");
  for (const bad of [undefined, null, "", "unknown", "video", ["web", "seo"], "web<script>", "a".repeat(41), 42, "../contact"]) {
    assert.equal(parseServiceParam(bad), null, JSON.stringify(bad));
  }
  assert.equal(isServiceId("graphic-design"), true);
  assert.equal(isServiceId("Graphic Design"), false);
});

test("every service and group has complete FR/EN/AR copy", () => {
  for (const l of LOCALES) {
    const sv = msgs[l].Services;
    for (const s of SERVICES) {
      for (const suffix of ["title", "subtitle", "desc", "features"]) {
        const v = sv[`${s.msg}_${suffix}`];
        assert.ok(typeof v === "string" && v.trim().length > 1, `${l}: Services.${s.msg}_${suffix}`);
      }
      const feats = sv[`${s.msg}_features`].split(",").map((f: string) => f.trim()).filter(Boolean);
      assert.ok(feats.length >= 3, `${l}: ${s.msg} has a real feature list`);
    }
    for (const g of SERVICE_GROUPS) {
      assert.ok(sv[`group_${g.msg}_title`]?.trim(), `${l}: group_${g.msg}_title`);
      assert.ok(sv[`group_${g.msg}_desc`]?.trim(), `${l}: group_${g.msg}_desc`);
    }
    assert.ok(sv.request_quote && sv.learn_more, `${l}: card actions`);
    const titles = SERVICES.map((s) => sv[`${s.msg}_title`]);
    assert.equal(new Set(titles).size, titles.length, `${l}: titles are distinct (they are the form values)`);
  }
});

test("Arabic copy is actually Arabic; French and English differ", () => {
  for (const s of SERVICES) {
    assert.match(msgs.ar.Services[`${s.msg}_desc`], /[؀-ۿ]/, `ar ${s.msg}_desc`);
    assert.notEqual(msgs.fr.Services[`${s.msg}_desc`], msgs.en.Services[`${s.msg}_desc`], `fr/en ${s.msg}_desc`);
  }
});

test("creative services make no unsupported claims (no clients, results, figures or experience)", () => {
  const banned = /(\d+\s*(%|\+|ans|years|clients|projets|projects))|clients satisfaits|happy clients|years of experience|ans d'expérience|سنوات|عملاء راضين/i;
  for (const l of LOCALES) {
    for (const msg of ["video", "reels", "graphic"]) {
      for (const suffix of ["title", "subtitle", "desc", "features"]) {
        assert.doesNotMatch(msgs[l].Services[`${msg}_${suffix}`], banned, `${l} ${msg}_${suffix}`);
      }
    }
    assert.doesNotMatch(msgs[l].Assistant.creative_reply, banned);
  }
});

test("homepage copy: four groups, new hero, no process or old hero keys left", () => {
  for (const l of LOCALES) {
    const h = msgs[l].HomeV2;
    const gone = ["s1", "s4", "s6_d", "offer_also", "value", "value_sub", "proc_kicker", "proc_title", "st1", "st1_t", "st4_d"];
    for (const k of gone) assert.equal(h[k], undefined, `${l}: HomeV2.${k} removed`);
    assert.ok(h.offer_title && h.offer_intro && h.offer_link && h.hero_title && h.hero_sub && h.tst_kicker && h.tst_title);
    assert.doesNotMatch(h.offer_title, /trois|three|ثلاثة/i, `${l}: offer title counts four groups`);
  }
  assert.equal(msgs.fr.HomeV2.hero_title, "Votre site web mérite mieux.");
  // The hero says both: we build, and we repair / improve.
  assert.match(msgs.fr.HomeV2.hero_sub, /Création, réparation et amélioration/);
  assert.match(msgs.en.HomeV2.hero_sub, /build, repair and improve/);
  assert.match(msgs.ar.HomeV2.hero_sub, /إنشاء.*وإصلاحها.*وتحسينها/);
});

test("the four-step process lives on the Web service page only, without promises it cannot keep", () => {
  const banned = {
    fr: /semaine|jour|sur place|hebdomadaire|garanti/i,
    en: /week|days?\b|on-site|weekly|guarantee/i,
    ar: /أسبوع|أيام|ميداني|أسبوعي|ضمان|نضمن/,
  } as const;
  for (const l of LOCALES) {
    const sd = msgs[l].ServiceDetail;
    for (const k of ["web_process_kicker", "web_process_title", ...[1, 2, 3, 4].flatMap((n) => [`web_process_s${n}`, `web_process_s${n}_d`])]) {
      assert.ok(sd[k]?.trim(), `${l}: ServiceDetail.${k}`);
      assert.doesNotMatch(sd[k], banned[l], `${l}: ServiceDetail.${k}`);
    }
    for (const k of Object.keys(msgs[l].Services)) assert.doesNotMatch(k, /^process_/, `${l}: Services.${k} moved to the Web page`);
  }
  assert.equal(msgs.fr.ServiceDetail.web_process_title, "De l'idée au lancement.");
  const detail = fs.readFileSync("src/app/[locale]/services/[slug]/page.tsx", "utf8");
  assert.match(detail, /key === "web" \? \(\s*<ProcessBars locale=\{locale\} \/>/, "on the Web detail page, in place of its 3-step block");
  for (const f of ["src/components/services-v2/ServicesV2.tsx", "src/components/home-v2/HomeV2.tsx"]) {
    assert.doesNotMatch(fs.readFileSync(f, "utf8"), /ProcessBars|<Process\b|proc_|process_s|STEPS/, `${f}: no process section`);
  }
});

test("website repair: complete detail copy, one-time (not maintenance), no prices or guarantees", () => {
  const oneTime = { fr: /ponctuel/, en: /one-time/, ar: /لمرة واحدة/ } as const;
  const noPrice = /\d+\s*(dh|mad|dirham|درهم|€|eur|\$|usd)|à partir de|starting at|from \d|ابتداء/i;
  const noGuarantee = /garanti|guarantee|ضمان|نضمن|مضمون|instantan|instant|48\s*h|24\s*h/i;
  for (const l of LOCALES) {
    const sd = msgs[l].ServiceDetail;
    const keys = ["title", "tagline", "intro", "features_title", "features", "tools", ...[1, 2, 3].flatMap((n) => [`step${n}_title`, `step${n}_desc`])];
    for (const k of keys) assert.ok(sd[`repair_${k}`]?.trim(), `${l}: ServiceDetail.repair_${k}`);
    const all = [...keys.map((k) => sd[`repair_${k}`]), msgs[l].Services.repair_desc, msgs[l].Services.repair_features, msgs[l].Assistant.repair_reply];
    for (const v of all) {
      assert.doesNotMatch(v, noPrice, `${l}: ${v}`);
      assert.doesNotMatch(v, noGuarantee, `${l}: ${v}`);
    }
    assert.match(sd.repair_intro, oneTime[l], `${l}: repair is a one-time project`);
    assert.match(msgs[l].Services.repair_desc, oneTime[l]);
    assert.match(msgs[l].Services.group_support_desc, oneTime[l], `${l}: the group explains repair vs maintenance`);
    assert.ok(sd.repair_features.split(",").length >= 7, `${l}: the full repair scope is listed`);
  }
  const detail = fs.readFileSync("src/app/[locale]/services/[slug]/page.tsx", "utf8");
  assert.match(detail, /const key = service\.msg;/, "detail copy is keyed by the catalog message key");
});

test("assistant options point at the catalog and have copy in every locale", () => {
  for (const o of OPTIONS) {
    if (o.catalog && "service" in o.catalog) assert.ok(isServiceId(o.catalog.service), o.id);
    if (o.catalog && "group" in o.catalog) assert.ok(SERVICE_GROUPS.some((g) => g.id === (o.catalog as { group: string }).group), o.id);
    for (const l of LOCALES) {
      assert.ok(msgs[l].Assistant[`${o.id}_label`], `${l}: Assistant.${o.id}_label`);
      if (o.hasReply) assert.ok(msgs[l].Assistant[`${o.id}_reply`], `${l}: Assistant.${o.id}_reply`);
    }
  }
  assert.ok(OPTIONS.some((o) => o.catalog && "group" in o.catalog && o.catalog.group === "creative"), "creative studio is reachable from the assistant");
  const covered = new Set(OPTIONS.flatMap((o) => (o.catalog && "service" in o.catalog ? [o.catalog.service] : [])));
  for (const id of ["booking", "automation", "ai", "website-repair"] as const) assert.ok(covered.has(id), `assistant covers ${id}`);
});

test("structured data lists every catalog service", () => {
  const layout = fs.readFileSync("src/app/[locale]/layout.tsx", "utf8");
  assert.match(layout, /serviceType: SERVICES\.map\(\(svc\) => svc\.schemaName\)/);
  assert.equal(new Set(SERVICES.map((s) => s.schemaName)).size, SERVICES.length);
});

test("SEO copy makes no guaranteed-results claim in FR, EN or AR", () => {
  const guarantee = {
    fr: /garanti|assure|certitude|résultats assurés/i,
    en: /guarantee|ensures?\b|assured|promise/i,
    ar: /يضمن|نضمن|تضمن|ضمان|مضمون|مؤكد/,
  } as const;
  for (const l of LOCALES) {
    const sv = msgs[l].Services;
    const sd = msgs[l].ServiceDetail;
    const seoCopy = [sv.seo_subtitle, sv.seo_desc, sv.seo_features, ...Object.entries(sd).filter(([k]) => k.startsWith("seo_")).map(([, v]) => v as string)];
    for (const v of seoCopy) assert.doesNotMatch(v, guarantee[l], `${l}: ${v}`);
  }
  // The outcome is framed as an aim in every locale.
  assert.match(msgs.fr.ServiceDetail.seo_intro, /vise à améliorer/);
  assert.match(msgs.en.ServiceDetail.seo_intro, /aims to improve/);
  assert.match(msgs.ar.ServiceDetail.seo_intro, /يهدف إلى/);
});

test("Arabic SEO copy: the tagline is not repeated in the description", () => {
  const ar = msgs.ar;
  const opening = (s: string) => s.split(/\s+/).slice(0, 2).join(" ");
  assert.notEqual(opening(ar.Services.seo_desc), opening(ar.Services.seo_subtitle));
  assert.notEqual(opening(ar.ServiceDetail.seo_intro.split("—")[1].trim()), opening(ar.ServiceDetail.seo_tagline));
});
