/**
 * Testimonial write paths and public filtering against a REAL, ISOLATED Postgres database
 * (one shared testimonial per project, stored on the French translation row).
 *
 * Skipped unless TESTIMONIAL_TEST_DATABASE_URL points at a local database (127.0.0.1 / localhost);
 * it refuses anything else, so it can never run against the production database. Every test
 * empties the tables it uses. Example (disposable container, schema pushed with a config that
 * hard-codes the same local URL):
 *   docker run -d --name ibda3-testimonial-testdb -e POSTGRES_USER=test -e POSTGRES_PASSWORD=testonly \
 *     -e POSTGRES_DB=ibda3_testimonial_test -p 127.0.0.1:55439:5432 --tmpfs /var/lib/postgresql/data postgres:16-alpine
 *   TESTIMONIAL_TEST_DATABASE_URL=postgresql://test:testonly@127.0.0.1:55439/ibda3_testimonial_test npm test
 * Fixtures are test data, not testimonials.
 */
import { test, mock, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

const URL_ = process.env.TESTIMONIAL_TEST_DATABASE_URL ?? "";
const host = (() => { try { return new URL(URL_).hostname; } catch { return ""; } })();
const isolated = URL_ !== "" && ["127.0.0.1", "localhost"].includes(host) && URL_ !== process.env.DATABASE_URL;
const skip = isolated ? false : "set TESTIMONIAL_TEST_DATABASE_URL to an isolated local database to run";

/* eslint-disable @typescript-eslint/no-explicit-any */
let client: any;
let dal: typeof import("../src/lib/dal");
let rules: typeof import("../src/lib/testimonial-approval");

before(async () => {
  if (!isolated) return;
  // The data layer talks to the isolated database through the plain Postgres adapter.
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL_ }) });
  mock.module("@/lib/prisma", { namedExports: { prisma: client, hasPrisma: () => true } });
  mock.module("next-intl/server", { namedExports: { getTranslations: async () => () => "" } });
  dal = await import("../src/lib/dal");
  rules = await import("../src/lib/testimonial-approval");
});
after(async () => { await client?.$disconnect(); });

const actor = { userId: "u-admin", userName: "Admin One", ipAddress: "127.0.0.1" };
const content = (locale: string, title: string) => ({ locale, title, desc: `${title} desc`, tags: "a, b" });
const LOCALES = ["fr", "en", "ar"] as const;

async function makeProject(slug: string, kind = "CLIENT", visible = true) {
  const p = await dal.createProject({
    slug, category: "web", url: "https://example.test", image: "", tag: "Tag", visible, kind,
    // A stale client could still send a testimonial on create: it must not be stored.
    translations: [
      { ...content("fr", `${slug} FR`), testimonial: "Injected on create." } as any,
      content("en", `${slug} EN`),
      content("ar", `${slug} AR`),
    ],
  });
  return p.id as string;
}

async function saveDraft(id: string, draft: any) {
  const state = (await dal.getTestimonialState(id))!;
  const plan = rules.planTestimonialSave(state, rules.draftSchema.parse(draft));
  return plan.changed ? dal.saveTestimonialDraft(id, plan, actor) : false;
}
const baseDraft = { author: "Fixture Author", consent: "Fixture consent reference", quote: "Fixture shared quote.", role: "Fixture role" };
const expectedFor = async (id: string) => {
  const s = (await dal.getTestimonialState(id))!;
  return { author: s.author, role: s.role, quote: s.quote };
};
const publish = async (id: string) => dal.approveTestimonial(id, await expectedFor(id), actor, "fp");
const audit = async () => (await client.auditLog.findMany({ orderBy: { createdAt: "asc" } })).map((a: any) => ({ action: a.action, ...JSON.parse(a.details ?? "{}") }));
const publicIn = async (locale: string) => (await dal.getPublishedTestimonials(locale)).map((r) => [r.slug, r.quote, r.author, r.role, r.project]);
const rowsOf = (id: string) => client.projectTranslation.findMany({ where: { projectId: id }, orderBy: { locale: "asc" } });

beforeEach(async () => {
  if (!isolated) return;
  await client.$executeRawUnsafe('TRUNCATE TABLE "audit_logs", "project_translations", "projects" CASCADE');
});

test("create never stores a testimonial", { skip }, async () => {
  const id = await makeProject("create-check");
  for (const r of await rowsOf(id)) assert.deepEqual([r.testimonial, r.testimonialRole, r.testimonialApprovedAt], [null, null, null], r.locale);
});

test("publish once → the same testimonial on FR, EN and AR (project name in the page language); edit → hidden everywhere", { skip }, async () => {
  const id = await makeProject("flow");
  await saveDraft(id, baseDraft);
  for (const l of LOCALES) assert.deepEqual(await publicIn(l), [], `${l}: a draft is not public`);

  assert.equal(await publish(id), true);
  for (const l of LOCALES) {
    assert.deepEqual(await publicIn(l), [["flow", "Fixture shared quote.", "Fixture Author", "Fixture role", `flow ${l.toUpperCase()}`]], l);
  }
  // Only the French row was written: EN/AR testimonial columns untouched (null).
  for (const r of await rowsOf(id)) {
    if (r.locale === "fr") continue;
    assert.deepEqual([r.testimonial, r.testimonialRole, r.testimonialApprovedAt], [null, null, null], r.locale);
  }

  assert.equal(await saveDraft(id, { ...baseDraft, quote: "Fixture shared quote, edited." }), true, "reported as unpublished");
  for (const l of LOCALES) assert.deepEqual(await publicIn(l), [], `${l}: hidden after the edit`);
  assert.deepEqual((await audit()).map((a: any) => `${a.action}${a.reason ? ":" + a.reason : ""}`), [
    "TESTIMONIAL_UPDATED", "TESTIMONIAL_APPROVED", "TESTIMONIAL_UPDATED", "TESTIMONIAL_REVOKED:quote_or_role_edited",
  ]);
  const raw = JSON.stringify(await client.auditLog.findMany());
  assert.ok(!raw.includes("Fixture shared quote") && !raw.includes("Fixture consent"), "the audit never stores the quote or the consent note");
});

test("today's production shapes: legacy EN/AR rows are preserved but never shown or written", { skip }, async () => {
  // Like Aylani: FR published with a newer quote; EN/AR published earlier with older text.
  const a = await makeProject("like-aylani");
  await saveDraft(a, { ...baseDraft, quote: "Newer French quote." });
  await publish(a);
  const legacyAt = new Date("2026-10-25T12:07:00Z");
  for (const l of ["en", "ar"]) {
    await client.projectTranslation.update({
      where: { projectId_locale: { projectId: a, locale: l } },
      data: { testimonial: "Older legacy text.", testimonialRole: "Legacy role", testimonialApprovedAt: legacyAt, testimonialApprovedBy: "Earlier admin" },
    });
  }
  // Like Luxury Copro: published in French only. Like Hammam Nour: a concept with a draft.
  const l = await makeProject("like-luxury");
  await saveDraft(l, { ...baseDraft, quote: "Second client quote." });
  await publish(l);
  const h = await makeProject("like-concept", "CONCEPT");
  await saveDraft(h, { ...baseDraft, quote: "Concept draft." });

  for (const loc of LOCALES) {
    const rows = await publicIn(loc);
    assert.deepEqual(rows.map((r) => [r[0], r[1]]), [["like-aylani", "Newer French quote."], ["like-luxury", "Second client quote."]], loc);
    assert.ok(!JSON.stringify(rows).includes("Older legacy text"), `${loc}: legacy text never shown`);
  }
  // Edits and publications keep the legacy rows exactly as they were.
  const before = (await rowsOf(a)).filter((r: any) => r.locale !== "fr");
  await saveDraft(a, { ...baseDraft, quote: "Newer French quote, edited." });
  await publish(a);
  await dal.revokeTestimonial(a, actor);
  const after_ = (await rowsOf(a)).filter((r: any) => r.locale !== "fr");
  assert.deepEqual(after_.map((r: any) => [r.locale, r.testimonial, r.testimonialRole, r.testimonialApprovedAt?.toISOString(), r.testimonialApprovedBy]),
    before.map((r: any) => [r.locale, r.testimonial, r.testimonialRole, r.testimonialApprovedAt?.toISOString(), r.testimonialApprovedBy]));
  // The admin state reads the French row only.
  assert.equal((await dal.getTestimonialState(a))!.quote, "Newer French quote, edited.");
});

test("author change and consent removal unpublish; no publishing without a consent reference", { skip }, async () => {
  const id = await makeProject("author");
  await saveDraft(id, baseDraft);
  await publish(id);
  assert.equal(await saveDraft(id, { ...baseDraft, author: "Another Author" }), true);
  assert.deepEqual(await publicIn("en"), []);
  await publish(id);
  assert.equal(await saveDraft(id, { ...baseDraft, author: "Another Author", consent: "" }), true);
  assert.deepEqual(await publicIn("fr"), []);
  assert.equal(await publish(id), false, "no publication without a consent reference");
  const reasons = (await audit()).filter((a: any) => a.action === "TESTIMONIAL_REVOKED").map((a: any) => a.reason);
  assert.deepEqual(reasons, ["author_edited", "consent_removed"]);
});

test("compare-and-set: stale values or a concept project write nothing", { skip }, async () => {
  const id = await makeProject("cas");
  await saveDraft(id, baseDraft);
  const before_ = (await audit()).length;
  assert.equal(await dal.approveTestimonial(id, { ...(await expectedFor(id)), quote: "Something else." }, actor, "fp"), false);
  assert.equal(await dal.approveTestimonial(id, { ...(await expectedFor(id)), author: "Someone" }, actor, "fp"), false);
  await client.project.update({ where: { id }, data: { kind: "CONCEPT" } });
  assert.equal(await publish(id), false);
  assert.equal((await audit()).length, before_);
  assert.equal((await dal.getTestimonialState(id))!.approvedAt, null);
});

test("a publication whose audit entry cannot be written is rolled back", { skip }, async () => {
  const id = await makeProject("atomic");
  await saveDraft(id, baseDraft);
  await assert.rejects(dal.approveTestimonial(id, await expectedFor(id), { userId: undefined as any, userName: "x" }, "fp"));
  assert.equal((await dal.getTestimonialState(id))!.approvedAt, null, "no publication without its audit row");
});

test("save preservation: project saves never touch the testimonial or its publication", { skip }, async () => {
  const id = await makeProject("keep");
  await saveDraft(id, baseDraft);
  await publish(id);
  const before_ = await rowsOf(id);
  await dal.updateProject(id, {
    slug: "keep", category: "web", url: "https://example.test/new", image: "", tag: "Tag", visible: true, kind: "CLIENT",
    translations: [
      { ...content("fr", "keep FR, renamed"), testimonial: "Stale text from an old tab.", testimonialApprovedAt: null } as any,
      content("en", "keep EN"),
      content("ar", "keep AR"),
    ],
  });
  const after_ = await rowsOf(id);
  for (const [b, a] of before_.map((b: any, i: number) => [b, after_[i]])) {
    assert.deepEqual([a.id, a.testimonial, a.testimonialRole, a.testimonialApprovedAt?.toISOString() ?? null], [b.id, b.testimonial, b.testimonialRole, b.testimonialApprovedAt?.toISOString() ?? null], a.locale);
  }
  assert.equal((await publicIn("fr"))[0]?.[4], "keep FR, renamed", "still published, with the new French title");
  assert.equal((await publicIn("en"))[0]?.[4], "keep EN");
  await dal.updateProject(id, { slug: "keep", category: "web", url: "", image: "", tag: "Tag", visible: true, translations: [] });
  assert.equal(await client.projectTranslation.count({ where: { projectId: id } }), 3);
});

test("public data: only visible Client projects; never drafts, legacy text or the consent note", { skip }, async () => {
  const shown = await makeProject("shown");
  const hidden = await makeProject("hidden-project", "CLIENT", false);
  const concept = await makeProject("concept", "CONCEPT");
  const draftOnly = await makeProject("draft-only");
  for (const id of [shown, hidden, concept, draftOnly]) await saveDraft(id, baseDraft);
  await publish(shown);
  await publish(hidden);
  await client.project.update({ where: { id: concept }, data: { kind: "CLIENT" } });
  await publish(concept);
  await client.project.update({ where: { id: concept }, data: { kind: "CONCEPT" } });

  for (const l of LOCALES) {
    const rows = await dal.getPublishedTestimonials(l);
    assert.deepEqual(rows.map((r) => r.slug), ["shown"], l);
    assert.deepEqual(Object.keys(rows[0]).sort(), ["approvedAt", "author", "kind", "project", "quote", "role", "slug", "visible"]);
    assert.ok(!JSON.stringify(rows).includes("Fixture consent"));
  }
  const cs = (await dal.getProjectBySlug("shown", "en")) as Record<string, any>;
  const keys = [...Object.keys(cs), ...Object.keys(cs.translation ?? {}), ...Object.keys(cs.translations?.[0] ?? {})];
  assert.ok(!keys.some((k) => /testimonial/i.test(k)), keys.filter((k) => /testimonial/i.test(k)).join());
});

test("manual hide unpublishes everywhere, is audited once, and keeps the text", { skip }, async () => {
  const id = await makeProject("hide");
  await saveDraft(id, baseDraft);
  await publish(id);
  assert.equal(await dal.revokeTestimonial(id, actor), true);
  assert.equal(await dal.revokeTestimonial(id, actor), false);
  for (const l of LOCALES) assert.deepEqual(await publicIn(l), []);
  const revokes = (await audit()).filter((a: any) => a.action === "TESTIMONIAL_REVOKED");
  assert.deepEqual(revokes.map((a: any) => [a.reason, a.scope]), [["manual", "all_languages"]]);
  assert.equal((await dal.getTestimonialState(id))!.quote, "Fixture shared quote.");
});
