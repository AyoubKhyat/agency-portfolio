/**
 * Renders the real components with real FR/EN/AR messages (data access, images,
 * fonts and CSS modules mocked) and checks the markup:
 * - homepage project cards open internal case studies, service groups link to the Services page
 * - homepage hero: two-step diagnosis form (step 1 markup), no process section, testimonials only when approved
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
import type { PublishedTestimonialRow } from "../src/lib/dal";

const msgs: Record<string, Record<string, unknown>> = Object.fromEntries(
  ["fr", "en", "ar"].map((l) => [l, JSON.parse(fs.readFileSync(`src/messages/${l}.json`, "utf8"))]),
);

// CSS modules: class name = key, so markup stays readable. The interop keys
// (__esModule / default) must not be turned into class names.
const classes: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_t, k) => (k === "__esModule" ? undefined : k === "default" ? classes : String(k)),
});
const cssModule = { defaultExport: classes };
for (const p of ["home-v2/home.module.css", "project-detail-v2/detail.module.css", "contact-v2/contact.module.css", "services-v2/process.module.css"]) {
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
// What the database query returns (empty unless a test sets it): the testimonial is shared, so the
// same rows for every locale, with the project name in the page language. lib/testimonials is real.
let published: PublishedTestimonialRow[] = [];
const projectName: Record<string, string> = { fr: "Dandana Cabaret", en: "Dandana Cabaret (EN)", ar: "دندنة" };
mock.module("@/lib/dal", {
  namedExports: {
    getHomepageProjects: async () => projects,
    getPortfolioProjects: async () => projects,
    getPublishedTestimonials: async (locale: string) => published.map((r) => ({ ...r, project: projectName[locale] ?? r.project })),
  },
});

// IntlProvider typed loosely so components can be passed as regular children.
const Provider = IntlProvider as unknown as (props: Record<string, unknown>) => ReactElement;
const withIntl = (locale: string, el: ReactElement) => createElement(Provider, { locale, messages: msgs[locale], timeZone: "Africa/Casablanca" }, el);

const html = (el: ReactElement) => renderToStaticMarkup(el);
// The homepage hero holds a client component (the diagnosis form), so it renders inside the intl provider.
async function renderHome(locale: "fr" | "en" | "ar") {
  const { default: HomeV2 } = await import("../src/components/home-v2/HomeV2");
  return html(withIntl(locale, await HomeV2({ locale })));
}
const inputs = (markup: string) => [...markup.matchAll(/<(?:input|textarea)\b([^>]*)>/g)].map((m) => m[1]);
const anchors = (markup: string) => [...markup.matchAll(/<a\b([^>]*)>/g)].map((m) => m[1]);
const unescape = (v: string) => v.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const attr = (a: string, name: string) => {
  const v = a.match(new RegExp(`${name}="([^"]*)"`))?.[1];
  return v === undefined ? undefined : unescape(v);
};

// ─── Homepage ────────────────────────────────────────────────────

test("homepage: client and concept cards open internal case studies (FR/EN/AR)", async () => {
  const label = { fr: "Voir l'étude de cas", en: "View Case Study", ar: "عرض دراسة الحالة" } as const;
  for (const locale of ["fr", "en", "ar"] as const) {
    const markup = await renderHome(locale);
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

test("homepage: four service groups, each linking once to its Services-page section (no hero chips)", async () => {
  const markup = await renderHome("fr");
  const hrefs = anchors(markup).map((a) => attr(a, "href"));
  for (const g of ["web-digital", "growth", "support", "creative"]) {
    assert.equal(hrefs.filter((h) => h === `/services#group-${g}`).length, 1, `${g}: one service row`);
  }
  assert.ok(markup.includes("Croissance &amp; SEO") && markup.includes("Support, réparation &amp; amélioration") && markup.includes("Studio créatif"));
  assert.ok(markup.includes("Quatre pôles, un seul interlocuteur."));
  const hero = anchors(markup).find((a) => attr(a, "data-wa-placement") === "home_hero")!;
  assert.ok(hero, "WhatsApp stays as the secondary hero action");
  assert.match(decodeURIComponent(attr(hero, "href")!), /je souhaite discuter d'un projet avec Ibda3 Digital/);
});

test("homepage hero: slogan lockup kept, new headline, and step 1 of the diagnosis form only (FR/EN/AR)", async () => {
  const copy = {
    fr: ["Votre site web mérite mieux.", "Diagnostic gratuit", "Adresse de votre site"],
    en: ["Your website deserves better.", "Free diagnosis", "Your website address"],
    ar: ["موقعك يستحق الأفضل.", "تشخيص مجاني", "رابط موقعك"],
  } as const;
  for (const locale of ["fr", "en", "ar"] as const) {
    const markup = await renderHome(locale);
    assert.match(markup, /<h1[^>]*lang="en"[\s\S]*We build[\s\S]*You grow[\s\S]*<\/h1>/, `${locale}: English slogan lockup`);
    for (const text of copy[locale]) assert.ok(markup.includes(text), `${locale}: ${text}`);
    const fields = inputs(markup);
    const url = fields.find((a) => attr(a, "name") === "siteUrl");
    assert.ok(url, `${locale}: the address field is named siteUrl`);
    assert.equal(attr(url!, "id"), "dg-siteUrl");
    assert.equal(attr(url!, "dir"), "ltr", `${locale}: address typed left-to-right`);
    assert.ok(markup.includes('for="dg-siteUrl"'), `${locale}: labelled`);
    assert.equal(attr(url!, "aria-describedby"), "dg-siteUrl-err");
    // Step 2 is not on the page until the address is validated.
    for (const name of ["fullName", "email", "phone", "problem"]) {
      assert.ok(!fields.some((a) => attr(a, "name") === name), `${locale}: ${name} waits for step 2`);
    }
    assert.match(markup, /<button[^>]*type="submit"[^>]*>[\s\S]*?<\/button>/);
  }
});

test("homepage hero: the diagnosis card holds the headline, three trust indicators and the unchanged form (FR/EN/AR)", async () => {
  const trust = {
    fr: ["Gratuit", "Sans engagement", "Aucun accès à votre site requis"],
    en: ["Free", "No commitment", "No access to your site needed"],
    ar: ["مجاني", "دون أي التزام", "لا نحتاج إلى أي صلاحية دخول إلى موقعك"],
  } as const;
  for (const locale of ["fr", "en", "ar"] as const) {
    const markup = await renderHome(locale);
    const card = markup.slice(markup.indexOf('class="grid12 heroBody dgCard"'), markup.indexOf('id="offer"'));
    assert.ok(card.length > 0, `${locale}: the card wraps the hero body`);
    const items = [...card.matchAll(/<li><svg[^>]*aria-hidden="true"[\s\S]*?<\/svg><span>([^<]+)<\/span><\/li>/g)].map((m) => m[1].replace(/&#x27;/g, "'"));
    assert.deepEqual(items, [...trust[locale]], `${locale}: trust indicators`);
    for (const needle of ['name="siteUrl"', 'data-wa-placement="home_hero"', 'id="home-v2-value"']) assert.ok(card.includes(needle), `${locale}: ${needle} inside the card`);
  }
  // The note under the field no longer repeats the trust indicators; it keeps what only it says.
  const note = { fr: [/Gratuit|engagement/i, /notre équipe.*rien n'y est modifié/], en: [/free|commitment/i, /Our team reviews.*nothing on it is changed/], ar: [/مجاني|التزام/, /يفحص فريقنا.*دون أي تعديل/] } as const;
  for (const l of ["fr", "en", "ar"] as const) {
    const text = (msgs[l].Diagnosis as Record<string, string>).note;
    assert.doesNotMatch(text, note[l][0], `${l}: no repeat of the trust indicators`);
    assert.match(text, note[l][1], `${l}: keeps the review and no-change information`);
    if (l !== "ar") assert.ok(text.includes("\u00a0\u2014") && !text.includes(" \u2014"), `${l}: the dash never starts a line (no-break space before it)`);
  }
  // Top-aligned columns: the headline does not move when step 2 makes the form taller.
  assert.match(fs.readFileSync("src/components/home-v2/home.module.css", "utf8"), /\.heroBody\.dgCard \{[^}]*align-items: start;[^}]*\}/);
});

test("homepage hero: the honeypot is separate from the address field, hidden and out of the tab order", async () => {
  const markup = await renderHome("fr");
  const fields = inputs(markup);
  const trap = fields.filter((a) => attr(a, "name") === "website");
  assert.equal(trap.length, 1, "one honeypot");
  assert.equal(attr(trap[0], "tabindex"), "-1");
  assert.notEqual(attr(trap[0], "type"), "url");
  assert.match(markup, /<div aria-hidden="true" class="srOnly"><input type="text"[^>]*name="website"/, "inside an aria-hidden wrapper");
  assert.equal(fields.filter((a) => attr(a, "name") === "siteUrl").length, 1);
});

test("homepage: the process section is gone and sections are numbered in order", async () => {
  for (const locale of ["fr", "en", "ar"] as const) {
    const markup = await renderHome(locale);
    assert.ok(!markup.includes('id="process"'), `${locale}: no process section`);
    assert.ok(!markup.includes("De l&#x27;idée au lancement") && !markup.includes("From idea to launch"));
    const nums = [...markup.matchAll(/class="secNum">\((\d{2})\)</g)].map((m) => m[1]);
    assert.deepEqual(nums, ["01", "02", "03", "04"], `${locale}: offer, why, work, contact`);
    // Order: hero form, services, why, brand story, work, (testimonials), contact.
    const at = (needle: string) => markup.indexOf(needle);
    assert.ok(at("dg-siteUrl") < at('id="offer"') && at('id="offer"') < at('id="why"'), `${locale}: offer before why`);
    assert.ok(at('id="why"') < at("إبداع</span></p>") && at("إبداع</span></p>") < at('id="work"'), `${locale}: brand story between why and work`);
    assert.ok(at('id="work"') < at('id="contact"'), `${locale}: work before contact`);
  }
});

test("homepage testimonials: hidden until published, then the same testimonial on FR, EN and AR", async () => {
  const row = (over: Partial<PublishedTestimonialRow> = {}): PublishedTestimonialRow => ({
    slug: "dandana-cabaret", kind: "CLIENT", visible: true, project: "Dandana Cabaret",
    author: "Fixture Author", role: "Fixture role", quote: "Fixture stored quote.", approvedAt: new Date("2026-10-01"), ...over,
  });
  published = [];
  let markup = await renderHome("fr");
  assert.ok(!markup.includes('id="testimonials"'), "no empty section");
  assert.ok(!markup.includes("Témoignages"));

  // Rows that slip through must still be dropped: unapproved, concept, hidden project.
  published = [row({ approvedAt: null }), row({ slug: "c", kind: "CONCEPT" }), row({ slug: "h", visible: false })];
  markup = await renderHome("fr");
  assert.ok(!markup.includes('id="testimonials"') && !markup.includes("Fixture stored quote."), "re-checked before rendering");

  published = [row()];
  try {
    markup = await renderHome("fr");
    assert.ok(markup.includes('id="testimonials"'));
    // dir="auto": the quote reads in its own direction whatever the page language.
    assert.match(markup, /<blockquote class="m-0"><p class="m-0" dir="auto">Fixture stored quote\.<\/p><\/blockquote>/);
    assert.ok(markup.includes("Ce que disent nos clients."));
    // One approved quote: static cards (nothing to loop), no hidden duplicate copy.
    assert.ok(!markup.includes('aria-hidden="true" class="contents"'));
    assert.ok(markup.includes("Fixture Author") && markup.includes("Fixture role · Dandana Cabaret"));
    const nums = [...markup.matchAll(/class="secNum">\((\d{2})\)</g)].map((m) => m[1]);
    assert.deepEqual(nums, ["01", "02", "03", "04", "05"], "testimonials take their number before contact");
    assert.ok(markup.indexOf('id="work"') < markup.indexOf('id="testimonials"'), "testimonials come after the work");
    assert.ok(markup.indexOf('id="testimonials"') < markup.indexOf('id="contact"'));
    // One shared testimonial: exactly the same quote, author and role in English and Arabic (no translation).
    for (const locale of ["en", "ar"] as const) {
      const other = await renderHome(locale);
      assert.match(other, /<p class="m-0" dir="auto">Fixture stored quote\.<\/p>/, `${locale}: same quote`);
      assert.ok(other.includes(`Fixture role · ${projectName[locale]}`), `${locale}: same role, project name in the page language`);
      assert.match(other, /<span class="[^"]*" dir="auto">Fixture Author<\/span>/, `${locale}: author, direction from its own text`);
    }
  } finally {
    published = [];
  }
});

test("no fictional sample testimonials remain in the source or the shipped translations", () => {
  const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(`${dir}/${d.name}`) : [`${dir}/${d.name}`]));
  assert.ok(!fs.existsSync("src/lib/testimonials-demo.ts"));
  for (const f of files("src").filter((f) => /\.(tsx?|json|css)$/.test(f))) {
    assert.doesNotMatch(fs.readFileSync(f, "utf8"), /NOT A REAL CLIENT REVIEW|IBDA3_TESTIMONIALS_DEMO|testimonials-demo|Exemple fictif|Fictional example|مثال وهمي/, f);
  }
});

test("brand story: the Arabic word's gradient covers the marks below the baseline (no clipping)", () => {
  const css = fs.readFileSync("src/components/home-v2/home.module.css", "utf8");
  assert.match(css, /\.nameWord \.gradText \{ display: inline-block; padding-bottom: 0\.3em; margin-bottom: -0\.3em; \}/);
});

test("admin editor: the testimonial panel comes before the case study section", () => {
  const form = fs.readFileSync("src/app/admin/projects/ProjectForm.tsx", "utf8");
  assert.ok(form.indexOf("<TestimonialPanel") > 0 && form.indexOf("<TestimonialPanel") < form.indexOf("{/* Case study */}"));
  assert.equal(form.split("<TestimonialPanel").length - 1, 1, "rendered once");
});

// ─── Case study ──────────────────────────────────────────────────

function project(features: string) {
  const tr = {
    id: "t1", projectId: "p1", locale: "fr", title: "Dandana Cabaret", desc: "Restaurant cabaret", tags: "", tagline: "Dîner et spectacle",
    metaDesc: "", client: "Dandana", industry: "Restaurant", challenge: "Le défi.", solution: "La solution.",
    step1Title: "", step1Desc: "", step2Title: "", step2Desc: "", step3Title: "", step3Desc: "",
    features, tech: "Next.js, React", result1Value: "", result1Label: "", result2Value: "", result2Label: "",
    result3Value: "", result3Label: "", results: "",
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

// ─── Web service page: the restored process ─────────────────────

test("web service page: the original rising-bar process, four steps, FR/EN/AR", async () => {
  const { default: ProcessBars } = await import("../src/components/services-v2/ProcessBars");
  const titles = { fr: "De l&#x27;idée au lancement.", en: "From idea to launch.", ar: "من الفكرة إلى الإطلاق." } as const;
  for (const locale of ["fr", "en", "ar"] as const) {
    const markup = html(await ProcessBars({ locale }));
    assert.ok(markup.includes(titles[locale]), `${locale}: heading`);
    const heights = [...markup.matchAll(/--h:(\d+)/g)].map((m) => Number(m[1]));
    assert.deepEqual(heights, [36, 72, 112, 160], `${locale}: four ascending bars`);
    assert.equal((markup.match(/class="bar" aria-hidden="true"/g) ?? []).length, 4);
    assert.deepEqual([...markup.matchAll(/class="stepNum" dir="ltr">(\d{2})</g)].map((m) => m[1]), ["01", "02", "03", "04"]);
    assert.ok(markup.includes(`dir="${locale === "ar" ? "rtl" : "ltr"}"`));
  }
  const fr = html(await ProcessBars({ locale: "fr" }));
  for (const t of ["Découverte", "Design", "Développement", "Lancement", "à Marrakech ou à distance"]) assert.ok(fr.includes(t), t);
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

test("contact form: field names are the EmailJS params the diagnosis form sends too", async () => {
  const { emailParams } = await import("../src/lib/contact-submit");
  const names = new Set(inputs(await renderForm("fr", null)).map((a) => attr(a, "name")).filter((n) => n && n !== "website"));
  const diag = Object.keys(emailParams({ fullName: "A", email: "a@b.ma", subject: "S", message: "M" }));
  assert.deepEqual([...names].sort(), [...diag].sort());
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
