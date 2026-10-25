/**
 * Testimonial write paths and public filtering against a REAL, ISOLATED Postgres database.
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

async function makeProject(slug: string, kind = "CLIENT", visible = true) {
  const p = await dal.createProject({
    slug, category: "web", url: "https://example.test", image: "", tag: "Tag", visible, kind,
    // A stale client could still send a testimonial on create: it must not be stored or copied.
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
  return plan.changed ? dal.saveTestimonialDraft(id, plan, actor) : [];
}
const baseDraft = {
  author: "Fixture Author", consent: "Fixture consent reference",
  locales: { fr: { quote: "Citation FR.", role: "Rôle FR" }, en: { quote: "Quote EN.", role: "Role EN" } },
};
const expectedFor = async (id: string, locale: "fr" | "en" | "ar") => {
  const s = (await dal.getTestimonialState(id))!;
  return { author: s.author, role: s.locales[locale]!.role, quote: s.locales[locale]!.quote };
};
const audit = async () => (await client.auditLog.findMany({ orderBy: { createdAt: "asc" } })).map((a: any) => ({ action: a.action, ...JSON.parse(a.details ?? "{}") }));

beforeEach(async () => {
  if (!isolated) return;
  await client.$executeRawUnsafe('TRUNCATE TABLE "audit_logs", "project_translations", "projects" CASCADE');
});

test("create never stores or copies a testimonial between locales", { skip }, async () => {
  const id = await makeProject("create-check");
  const rows = await client.projectTranslation.findMany({ where: { projectId: id } });
  assert.equal(rows.length, 3);
  for (const r of rows) assert.deepEqual([r.testimonial, r.testimonialRole, r.testimonialApprovedAt], [null, null, null], r.locale);
});

test("approve → public; edit → revoked and hidden; every step audited in the same transaction", { skip }, async () => {
  const id = await makeProject("flow");
  await saveDraft(id, baseDraft);
  assert.equal((await dal.getPublishedTestimonials("fr")).length, 0, "a saved draft is not public");

  assert.equal(await dal.approveTestimonial(id, "fr", await expectedFor(id, "fr"), actor, "fp1"), true);
  const pub = await dal.getPublishedTestimonials("fr");
  assert.deepEqual(pub.map((r) => [r.slug, r.quote, r.author, r.role]), [["flow", "Citation FR.", "Fixture Author", "Rôle FR"]]);
  assert.equal(pub[0].approvedAt instanceof Date, true);

  const revoked = await saveDraft(id, { ...baseDraft, locales: { ...baseDraft.locales, fr: { quote: "Citation FR, modifiée.", role: "Rôle FR" } } });
  assert.deepEqual(revoked, ["fr"]);
  assert.equal((await dal.getPublishedTestimonials("fr")).length, 0, "edited quote is hidden");
  const fr = await client.projectTranslation.findFirst({ where: { projectId: id, locale: "fr" } });
  assert.deepEqual([fr.testimonial, fr.testimonialApprovedAt, fr.testimonialApprovedBy], ["Citation FR, modifiée.", null, null]);

  assert.deepEqual((await audit()).map((a: any) => `${a.action}${a.locale ? ":" + a.locale : ""}${a.reason ? ":" + a.reason : ""}`), [
    "TESTIMONIAL_UPDATED", "TESTIMONIAL_APPROVED:fr", "TESTIMONIAL_UPDATED", "TESTIMONIAL_REVOKED:fr:quote_or_role_edited",
  ]);
  const raw = JSON.stringify(await client.auditLog.findMany());
  assert.ok(!raw.includes("Citation") && !raw.includes("Fixture consent"), "the audit never stores the quote or the consent note");
});

test("language isolation: approving FR publishes FR only; editing EN leaves FR published", { skip }, async () => {
  const id = await makeProject("iso");
  await saveDraft(id, baseDraft);
  await dal.approveTestimonial(id, "fr", await expectedFor(id, "fr"), actor, "fp");
  assert.equal((await dal.getPublishedTestimonials("fr")).length, 1);
  assert.equal((await dal.getPublishedTestimonials("en")).length, 0);
  assert.equal((await dal.getPublishedTestimonials("ar")).length, 0);
  await saveDraft(id, { ...baseDraft, locales: { ...baseDraft.locales, en: { quote: "Quote EN, edited.", role: "Role EN" } } });
  assert.equal((await dal.getPublishedTestimonials("fr")).length, 1, "FR untouched by an EN edit");
});

test("author change and consent removal revoke every published locale", { skip }, async () => {
  const id = await makeProject("author");
  await saveDraft(id, baseDraft);
  await dal.approveTestimonial(id, "fr", await expectedFor(id, "fr"), actor, "fp");
  await dal.approveTestimonial(id, "en", await expectedFor(id, "en"), actor, "fp");
  assert.deepEqual((await saveDraft(id, { ...baseDraft, author: "Another Author" })).sort(), ["en", "fr"]);
  assert.equal((await dal.getPublishedTestimonials("fr")).length + (await dal.getPublishedTestimonials("en")).length, 0);

  await dal.approveTestimonial(id, "fr", await expectedFor(id, "fr"), actor, "fp");
  assert.deepEqual(await saveDraft(id, { ...baseDraft, author: "Another Author", consent: "" }), ["fr"]);
  assert.equal((await dal.getPublishedTestimonials("fr")).length, 0);
  assert.equal(await dal.approveTestimonial(id, "fr", await expectedFor(id, "fr"), actor, "fp"), false, "no approval without a consent reference");
});

test("compare-and-set: approval with stale values, or on a concept project, writes nothing", { skip }, async () => {
  const id = await makeProject("cas");
  await saveDraft(id, baseDraft);
  const before = (await audit()).length;
  assert.equal(await dal.approveTestimonial(id, "fr", { author: "Fixture Author", role: "Rôle FR", quote: "Something else." }, actor, "fp"), false);
  assert.equal(await dal.approveTestimonial(id, "fr", { author: "Someone", role: "Rôle FR", quote: "Citation FR." }, actor, "fp"), false);
  await client.project.update({ where: { id }, data: { kind: "CONCEPT" } });
  assert.equal(await dal.approveTestimonial(id, "fr", await expectedFor(id, "fr"), actor, "fp"), false);
  assert.equal((await audit()).length, before, "refusals are not audited as approvals");
  const fr = await client.projectTranslation.findFirst({ where: { projectId: id, locale: "fr" } });
  assert.equal(fr.testimonialApprovedAt, null);
});

test("an approval whose audit entry cannot be written is rolled back", { skip }, async () => {
  const id = await makeProject("atomic");
  await saveDraft(id, baseDraft);
  await assert.rejects(dal.approveTestimonial(id, "fr", await expectedFor(id, "fr"), { userId: undefined as any, userName: "x" }, "fp"));
  const fr = await client.projectTranslation.findFirst({ where: { projectId: id, locale: "fr" } });
  assert.equal(fr.testimonialApprovedAt, null, "no approval without its audit row");
});

test("save preservation: project saves (any locale, stale payloads) never touch the testimonial or its approval", { skip }, async () => {
  const id = await makeProject("keep");
  await saveDraft(id, baseDraft);
  await dal.approveTestimonial(id, "fr", await expectedFor(id, "fr"), actor, "fp");
  const before = await client.projectTranslation.findMany({ where: { projectId: id }, orderBy: { locale: "asc" } });

  // A normal save of all three locales, edited content, and a stale client sending old testimonial values.
  await dal.updateProject(id, {
    slug: "keep", category: "web", url: "https://example.test/new", image: "", tag: "Tag", visible: true, kind: "CLIENT",
    translations: [
      { ...content("fr", "keep FR, renamed"), testimonial: "Stale text from an old tab.", testimonialApprovedAt: null } as any,
      { ...content("en", "keep EN"), testimonialRole: "Hacked role" } as any,
      content("ar", "keep AR"),
    ],
  });
  const after_ = await client.projectTranslation.findMany({ where: { projectId: id }, orderBy: { locale: "asc" } });
  for (const [b, a] of before.map((b: any, i: number) => [b, after_[i]])) {
    assert.deepEqual(
      [a.locale, a.testimonial, a.testimonialRole, a.testimonialApprovedAt?.toISOString() ?? null, a.testimonialApprovedBy],
      [b.locale, b.testimonial, b.testimonialRole, b.testimonialApprovedAt?.toISOString() ?? null, b.testimonialApprovedBy],
    );
    assert.equal(a.id, b.id, `${a.locale}: updated in place, not recreated`);
  }
  assert.equal(after_.find((t: any) => t.locale === "fr").title, "keep FR, renamed", "content is saved");
  assert.equal((await dal.getPublishedTestimonials("fr"))[0]?.project, "keep FR, renamed", "still published, with the new project title");

  // Saving with an empty payload keeps every translation (it used to delete them all).
  await dal.updateProject(id, { slug: "keep", category: "web", url: "", image: "", tag: "Tag", visible: true, translations: [] });
  assert.equal(await client.projectTranslation.count({ where: { projectId: id } }), 3);
});

test("public data: only approved rows of visible Client projects; never unapproved text or the consent note", { skip }, async () => {
  const shown = await makeProject("shown");
  const hidden = await makeProject("hidden-project", "CLIENT", false);
  const concept = await makeProject("concept", "CONCEPT");
  const draftOnly = await makeProject("draft-only");
  for (const id of [shown, hidden, concept, draftOnly]) await saveDraft(id, baseDraft);
  await dal.approveTestimonial(shown, "fr", await expectedFor(shown, "fr"), actor, "fp");
  await dal.approveTestimonial(hidden, "fr", await expectedFor(hidden, "fr"), actor, "fp");
  // Approved while a client, then reclassified as a concept: must disappear.
  await client.project.update({ where: { id: concept }, data: { kind: "CLIENT" } });
  await dal.approveTestimonial(concept, "fr", await expectedFor(concept, "fr"), actor, "fp");
  await client.project.update({ where: { id: concept }, data: { kind: "CONCEPT" } });

  const rows = await dal.getPublishedTestimonials("fr");
  assert.deepEqual(rows.map((r) => r.slug), ["shown"]);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["approvedAt", "author", "kind", "project", "quote", "role", "slug", "visible"]);
  assert.ok(!JSON.stringify(rows).includes("Fixture consent"));

  // The case-study query loads no testimonial field at all, approved or not, and no consent note.
  const cs = (await dal.getProjectBySlug("shown", "fr")) as Record<string, any>;
  const keys = [...Object.keys(cs), ...Object.keys(cs.translation ?? {}), ...Object.keys(cs.translations?.[0] ?? {})];
  assert.ok(!keys.some((k) => /testimonial/i.test(k)), keys.filter((k) => /testimonial/i.test(k)).join());
  assert.ok(!JSON.stringify(cs).includes("Citation FR") && !JSON.stringify(cs).includes("Fixture consent"));
});

test("manual revoke hides it, is audited once, and a second revoke changes nothing", { skip }, async () => {
  const id = await makeProject("revoke");
  await saveDraft(id, baseDraft);
  await dal.approveTestimonial(id, "fr", await expectedFor(id, "fr"), actor, "fp");
  assert.equal(await dal.revokeTestimonial(id, "fr", actor), true);
  assert.equal(await dal.revokeTestimonial(id, "fr", actor), false);
  assert.equal((await dal.getPublishedTestimonials("fr")).length, 0);
  const revokes = (await audit()).filter((a: any) => a.action === "TESTIMONIAL_REVOKED");
  assert.deepEqual(revokes.map((a: any) => [a.locale, a.reason]), [["fr", "manual"]]);
  const fr = await client.projectTranslation.findFirst({ where: { projectId: id, locale: "fr" } });
  assert.equal(fr.testimonial, "Citation FR.", "the text is kept");
});
