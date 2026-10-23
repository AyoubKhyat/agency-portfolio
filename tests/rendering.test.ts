/**
 * Renders the real components with real FR/EN/AR messages (data access, images,
 * fonts and CSS modules mocked) and checks the markup:
 * - homepage project cards open internal case studies, service groups link to the Services page
 * - case studies hide Key Features when there are no features
 * - the contact form offers every catalog service and honours ?service= preselection
 * Needs --experimental-test-module-mocks (see the "test" script).
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider, createTranslator } from "use-intl";

const msgs: Record<string, Record<string, unknown>> = Object.fromEntries(
  ["fr", "en", "ar"].map((l) => [l, JSON.parse(fs.readFileSync(`src/messages/${l}.json`, "utf8"))]),
);

// CSS modules: class name = key, so markup stays readable. The interop keys
// (__esModule / default) must not be turned into class names.
const classes: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_t, k) => (k === "__esModule" ? undefined : k === "default" ? classes : String(k)),
});
const cssModule = { defaultExport: classes };
for (const p of ["home-v2/home.module.css", "project-detail-v2/detail.module.css", "contact-v2/contact.module.css"]) {
  mock.module(`../src/components/${p}`, cssModule);
}
mock.module("../src/components/home-v2/fonts", { namedExports: { alexandria: { variable: "alexandria" }, tajawal: { variable: "tajawal" } } });
mock.module("next/image", { defaultExport: (p: { src: string; alt: string }) => createElement("img", { src: p.src, alt: p.alt }) });
mock.module("@/i18n/navigation", {
  namedExports: {
    Link: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement("a", { href, ...rest }, children),
  },
});
mock.module("next-intl/server", {
  namedExports: {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
      createTranslator({ locale, messages: msgs[locale] as never, namespace: namespace as never }),
  },
});

const projects = [
  { slug: "dandana-cabaret", url: "https://dandanacabaret.com/", image: "/projects/d.webp", title: "Dandana Cabaret", sector: "Restaurant", kind: "CLIENT", desc: "", tags: [] },
  { slug: "terrene", url: "https://terrene.webyms.com/", image: "/projects/terrene.webp", title: "Terrene Studio", sector: "Architecture", kind: "CLIENT", desc: "", tags: [] },
  { slug: "tannour", url: "https://tannour.vercel.app/", image: "/projects/tannour.webp", title: "Tannour", sector: "E-commerce", kind: "CONCEPT", desc: "", tags: [] },
];
mock.module("@/lib/dal", { namedExports: { getHomepageProjects: async () => projects, getPortfolioProjects: async () => projects } });

const html = (el: ReactElement) => renderToStaticMarkup(el);
const anchors = (markup: string) => [...markup.matchAll(/<a\b([^>]*)>/g)].map((m) => m[1]);
const unescape = (v: string) => v.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const attr = (a: string, name: string) => {
  const v = a.match(new RegExp(`${name}="([^"]*)"`))?.[1];
  return v === undefined ? undefined : unescape(v);
};

// ─── Homepage ────────────────────────────────────────────────────

test("homepage: client and concept cards open internal case studies (FR/EN/AR)", async () => {
  const { default: HomeV2 } = await import("../src/components/home-v2/HomeV2");
  const label = { fr: "Voir l'étude de cas", en: "View Case Study", ar: "عرض دراسة الحالة" } as const;
  for (const locale of ["fr", "en", "ar"] as const) {
    const markup = html(await HomeV2({ locale }));
    const links = anchors(markup);
    for (const slug of ["dandana-cabaret", "terrene", "tannour"]) {
      const card = links.filter((a) => attr(a, "href") === `/portfolio/${slug}`);
      assert.ok(card.length >= 1, `${locale}: ${slug} links to its case study`);
      for (const a of card) assert.equal(attr(a, "target"), undefined, `${locale}: ${slug} stays on the site`);
    }
    for (const external of ["https://dandanacabaret.com/", "https://terrene.webyms.com/", "https://tannour.vercel.app/"]) {
      assert.ok(!links.some((a) => attr(a, "href") === external), `${locale}: no card links straight to ${external}`);
    }
    const shot = links.find((a) => attr(a, "href") === "/portfolio/dandana-cabaret" && attr(a, "data-cta"));
    assert.equal(attr(shot!, "data-cta"), label[locale], `${locale}: hover label is "View Case Study"`);
  }
});

test("homepage: three service groups, each linking to its Services-page section", async () => {
  const { default: HomeV2 } = await import("../src/components/home-v2/HomeV2");
  const markup = html(await HomeV2({ locale: "fr" }));
  const hrefs = anchors(markup).map((a) => attr(a, "href"));
  for (const g of ["web-digital", "growth", "creative"]) {
    assert.equal(hrefs.filter((h) => h === `/services#group-${g}`).length, 2, `${g}: hero chip + service row`);
  }
  assert.ok(markup.includes("Studio créatif") && markup.includes("Croissance &amp; support"));
  assert.ok(!markup.includes('href="#offer"'), "hero chips no longer just scroll the page");
  const hero = anchors(markup).find((a) => attr(a, "data-wa-placement") === "home_hero")!;
  assert.match(decodeURIComponent(attr(hero, "href")!), /je souhaite discuter d'un projet avec Ibda3 Digital/);
});

// ─── Case study ──────────────────────────────────────────────────

function project(features: string) {
  const tr = {
    id: "t1", projectId: "p1", locale: "fr", title: "Dandana Cabaret", desc: "Restaurant cabaret", tags: "", tagline: "Dîner et spectacle",
    metaDesc: "", client: "Dandana", industry: "Restaurant", challenge: "Le défi.", solution: "La solution.",
    step1Title: "", step1Desc: "", step2Title: "", step2Desc: "", step3Title: "", step3Desc: "",
    features, tech: "Next.js, React", result1Value: "", result1Label: "", result2Value: "", result2Label: "",
    result3Value: "", result3Label: "", results: "", testimonial: "",
  };
  return {
    id: "p1", slug: "dandana-cabaret", category: "web", url: "https://dandanacabaret.com/", image: "/projects/d.webp", tag: "Restaurant",
    visible: true, status: "PUBLISHED", kind: "CLIENT", sortOrder: 8, createdAt: new Date(), updatedAt: new Date(), translations: [tr], translation: tr,
  };
}

test("case study: Key Features (section and its number) is hidden when there are no features", async () => {
  const { default: ProjectDetailV2 } = await import("../src/components/project-detail-v2/ProjectDetailV2");
  const heading = (msgs.fr.CaseStudy as Record<string, string>).features_label;
  const without = html(await ProjectDetailV2({ project: project("") as never, locale: "fr" }));
  assert.ok(!without.includes(heading), "no empty Key Features section");
  assert.ok(without.includes("Next.js, React"), "the stack is still shown in the facts row");
  const withFeatures = html(await ProjectDetailV2({ project: project("Réservation en ligne, Menu digital") as never, locale: "fr" }));
  assert.ok(withFeatures.includes(heading));
  assert.ok(withFeatures.includes("Réservation en ligne"));
});

test("case study: contextual WhatsApp CTA names the project", async () => {
  const { default: ProjectDetailV2 } = await import("../src/components/project-detail-v2/ProjectDetailV2");
  const markup = html(await ProjectDetailV2({ project: project("") as never, locale: "fr" }));
  const cta = anchors(markup).find((a) => attr(a, "data-wa-placement") === "case_study_cta")!;
  assert.match(decodeURIComponent(attr(cta, "href")!), /l'étude de cas Dandana Cabaret/);
});

// ─── Contact form ────────────────────────────────────────────────

async function renderForm(locale: "fr" | "en" | "ar", initialService: string | null) {
  const { default: ContactForm } = await import("../src/components/contact-v2/ContactForm");
  return html(
    createElement(
      Provider,
      { locale, messages: msgs[locale], timeZone: "Africa/Casablanca" },
      createElement(ContactForm, { waUrl: "https://wa.me/212625461645", initialService: initialService as never }),
    ),
  );
}
// IntlProvider typed loosely so the form can be passed as a regular child.
const Provider = IntlProvider as unknown as (props: Record<string, unknown>) => ReactElement;
const radios = (markup: string) => [...markup.matchAll(/<input\b([^>]*type="radio"[^>]*)>/g)].map((m) => m[1]);

test("contact form: every catalog service is selectable, grouped, plus Other (FR/EN/AR)", async () => {
  const { SERVICES } = await import("../src/lib/services-catalog");
  for (const locale of ["fr", "en", "ar"] as const) {
    const r = radios(await renderForm(locale, null));
    const ids = r.map((a) => attr(a, "data-service-id"));
    assert.deepEqual(ids, [...SERVICES.map((s) => s.id), "other"], locale);
    const sv = msgs[locale].Services as Record<string, string>;
    for (const s of SERVICES) assert.ok(r.some((a) => attr(a, "value") === sv[`${s.msg}_title`]), `${locale}: ${s.id}`);
  }
});

test("contact form: ?service= preselects exactly that service; unknown preselects nothing", async () => {
  const pre = radios(await renderForm("fr", "video-editing"));
  const checked = pre.filter((a) => /\bchecked=""/.test(a));
  assert.equal(checked.length, 1);
  assert.equal(attr(checked[0], "data-service-id"), "video-editing");
  const { parseServiceParam } = await import("../src/lib/services-catalog");
  const none = radios(await renderForm("ar", parseServiceParam("not-a-service")));
  assert.equal(none.filter((a) => /\bchecked=""/.test(a)).length, 0);
});
