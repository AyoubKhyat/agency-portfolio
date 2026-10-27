/**
 * Account security end to end against a REAL, DISPOSABLE Neon branch: the real Prisma Neon adapter,
 * real transactions, the real login, users, reset-password, sign-link and signing routes. Only the
 * Next.js cookie store is simulated.
 *
 * Skipped unless AUTH_TEST_DATABASE_URL is set. It refuses to run when that URL points at the same
 * host as the DATABASE_URL in .env (production) or when the database holds any lead, so it cannot
 * touch customer data. Use a schema-only branch, e.g.:
 *   npx neonctl branches create --schema-only --name auth-it-<date> --expires-at <ISO time>
 *   AUTH_TEST_DATABASE_URL=<that branch's connection string> npm test
 * Every run uses fresh, uniquely named fixture accounts.
 */
import { test, mock, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";

const URL_ = process.env.AUTH_TEST_DATABASE_URL ?? "";
const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return ""; } };
const prodHost = (() => {
  try { return hostOf(/^DATABASE_URL=["']?([^"'\r\n]+)/m.exec(readFileSync(new URL("../.env", import.meta.url), "utf8"))?.[1] ?? ""); } catch { return ""; }
})();
const usable = URL_ !== "" && hostOf(URL_) !== "" && hostOf(URL_) !== prodHost && hostOf(URL_) !== hostOf(process.env.DATABASE_URL ?? "");
const skip = usable ? false : "set AUTH_TEST_DATABASE_URL to a disposable, non-production database to run";

process.env.JWT_SECRET = "integration-secret-0123456789-abcdefghijklmnop";
if (usable) process.env.DATABASE_URL = URL_;

let cookie: string | undefined;
mock.module("next/headers", {
  namedExports: { cookies: async () => ({ get: (n: string) => (n === "admin_token" && cookie ? { name: n, value: cookie } : undefined) }) },
});
mock.module("next-intl/server", { namedExports: { getTranslations: async () => () => "" } });

/* eslint-disable @typescript-eslint/no-explicit-any */
let prisma: any;
let auth: typeof import("../src/lib/auth");
let loginRoute: typeof import("../src/app/api/admin/login/route");
let usersRoute: typeof import("../src/app/api/admin/users/route");
let userRoute: typeof import("../src/app/api/admin/users/[id]/route");
let resetRoute: typeof import("../src/app/api/admin/reset-password/route");
let signLinkRoute: typeof import("../src/app/api/admin/contracts/[id]/sign-link/route");
let signRoute: typeof import("../src/app/api/sign/[token]/route");
let prospectRoute: typeof import("../src/app/api/admin/prospecting/[id]/route");
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const R: Record<string, any> = {};

const run = randomBytes(4).toString("hex");
const mail = (who: string) => `it-${run}-${who}@example.test`;
const PW = { owner: `owner-pass-${run}-xyz`, staff: `staff-pass-${run}-xyz`, member: `member-pass-${run}-xyz` };
const ids: Record<string, string> = {};
let ip = 0;

before(async () => {
  if (!usable) return;
  ({ prisma } = await import("../src/lib/prisma"));
  const leads = await prisma.lead.count();
  if (leads !== 0) throw new Error("Refusing to run: this database contains leads, so it is not a disposable test branch.");
  auth = await import("../src/lib/auth");
  loginRoute = await import("../src/app/api/admin/login/route");
  usersRoute = await import("../src/app/api/admin/users/route");
  userRoute = await import("../src/app/api/admin/users/[id]/route");
  resetRoute = await import("../src/app/api/admin/reset-password/route");
  signLinkRoute = await import("../src/app/api/admin/contracts/[id]/sign-link/route");
  signRoute = await import("../src/app/api/sign/[token]/route");
  prospectRoute = await import("../src/app/api/admin/prospecting/[id]/route");
  R.export = await import("../src/app/api/admin/export/route");
  R.csv = await import("../src/app/api/admin/export/csv/route");
  R.backup = await import("../src/app/api/admin/export/backup/route");
  R.audit = await import("../src/app/api/admin/audit/route");
  R.debug = await import("../src/app/api/admin/debug/route");
  R.webhooks = await import("../src/app/api/admin/webhooks/route");
  R.webhook = await import("../src/app/api/admin/webhooks/[id]/route");
  R.webhookTest = await import("../src/app/api/admin/webhooks/test/route");
  R.leads = await import("../src/app/api/admin/leads/route");
  R.clients = await import("../src/app/api/admin/clients/route");
  R.prospecting = await import("../src/app/api/admin/prospecting/route");

  // Bootstrap two accounts the way they exist in production today: both "admin" in the database.
  for (const who of ["owner", "staff"] as const) {
    const passwordHash = await auth.hashPassword(PW[who]);
    await prisma.adminUser.create({ data: { email: mail(who), passwordHash, name: who } });
    const u = await prisma.user.create({ data: { email: mail(who), passwordHash, fullName: who, role: "admin", avatarInitials: "IT" } });
    ids[who] = u.id;
  }
  process.env.OWNER_USER_ID = ids.owner;
});
after(async () => { await prisma?.$disconnect(); });

const post = (url: string, body: unknown, method = "POST") =>
  new Request(url, { method, headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ip}` }, body: JSON.stringify(body) });
async function login(email: string, password: string) {
  const res = (await loginRoute.POST(post("http://x/api/admin/login", { email, password }))) as NextResponse;
  return { status: res.status, cookie: res.cookies.get("admin_token")?.value };
}
async function as(c: string | undefined) { cookie = c; return auth.getSession(); }
const createUser = (body: unknown) => usersRoute.POST(post("http://x/api/admin/users", body));
const patchUser = (id: string, body: unknown) => userRoute.PATCH(post(`http://x/api/admin/users/${id}`, body, "PATCH"), { params: Promise.resolve({ id }) });
const reset = (body: unknown) => resetRoute.POST(post("http://x/api/admin/reset-password", body));
const hashes = async (email: string) => {
  const [l, u] = await Promise.all([prisma.adminUser.findUnique({ where: { email } }), prisma.user.findUnique({ where: { email } })]);
  return { login: l?.passwordHash ?? null, user: u?.passwordHash ?? null };
};

test("owner creates a team member who can really sign in; both tables match", { skip }, async () => {
  const owner = await login(mail("owner"), PW.owner);
  assert.equal(owner.status, 200);
  cookie = owner.cookie;
  const res = await createUser({ fullName: "Member", email: mail("member").toUpperCase(), password: PW.member, role: "sales", avatarInitials: "ME" });
  assert.equal(res.status, 201);
  ids.member = (await res.json()).id;
  const h = await hashes(mail("member"));
  assert.ok(h.login && h.login === h.user, "login row created with the same hash as the team row");
  const member = await login(mail("member").toUpperCase(), PW.member);
  assert.equal(member.status, 200, "the new member can log in (email is case-insensitive)");
  assert.equal((await as(member.cookie))?.userId, ids.member);
  const audit = await prisma.auditLog.findFirst({ where: { action: "CREATE_USER", entityId: ids.member } });
  assert.ok(audit, "creation is audited");

  cookie = owner.cookie;
  assert.equal((await createUser({ fullName: "Dup", email: mail("staff"), password: PW.member, role: "sales", avatarInitials: "D" })).status, 409);
  assert.equal(await prisma.adminUser.count({ where: { email: mail("staff") } }), 1, "no duplicate login row");
});

test("a role change by the owner applies to an open session at once; the token's role claim is ignored", { skip }, async () => {
  const staffCookie = (await login(mail("staff"), PW.staff)).cookie;
  const fixture = await prisma.prospect.create({ data: { name: `IT prospect ${run}`, phone: "+000", whatsappLink: "https://example.test", sector: "test" } });
  const delProspect = () => prospectRoute.DELETE(new Request("http://x/api/admin/prospecting/x", { method: "DELETE" }), { params: Promise.resolve({ id: fixture.id }) });
  cookie = (await login(mail("owner"), PW.owner)).cookie;
  assert.equal((await patchUser(ids.staff, { role: "sales" })).status, 200);
  cookie = staffCookie;
  assert.equal((await auth.getSession())?.role, "sales", "same cookie, new role, no re-login");
  assert.equal((await delProspect()).status, 403, "admin-only action refused for the token that still says admin");
  cookie = (await login(mail("owner"), PW.owner)).cookie;
  assert.equal((await patchUser(ids.staff, { role: "admin" })).status, 200);
  cookie = staffCookie;
  assert.equal((await auth.getSession())?.role, "admin");
  assert.equal((await delProspect()).status, 200, "admin again: the same session may delete");
  assert.equal(await prisma.prospect.count({ where: { id: fixture.id } }), 0);
});

test("a non-owner admin cannot manage accounts, whatever its role", { skip }, async () => {
  const staff = await login(mail("staff"), PW.staff);
  assert.equal(staff.status, 200);
  cookie = staff.cookie;
  const ownerBefore = await hashes(mail("owner"));
  assert.equal((await createUser({ fullName: "X", email: mail("x"), password: PW.member, role: "admin", avatarInitials: "X" })).status, 403);
  assert.equal((await reset({ userId: ids.owner, newPassword: "attacker-chosen-password" })).status, 403);
  assert.equal((await patchUser(ids.owner, { password: "attacker-chosen-password" })).status, 403);
  assert.equal((await patchUser(ids.owner, { email: mail("hijack") })).status, 403);
  assert.equal((await patchUser(ids.member, { isActive: false })).status, 403);
  assert.equal((await patchUser(ids.staff, { role: "designer" })).status, 403);
  assert.deepEqual(await hashes(mail("owner")), ownerBefore, "owner password untouched");
  assert.equal(await prisma.user.count({ where: { email: mail("x") } }), 0);
});

test("OWNER_USER_ID: unset or pointing elsewhere means no owner rights", { skip }, async () => {
  cookie = (await login(mail("owner"), PW.owner)).cookie;
  delete process.env.OWNER_USER_ID;
  assert.equal((await reset({ userId: ids.member, newPassword: "unused-password-123" })).status, 403);
  process.env.OWNER_USER_ID = ids.staff;
  assert.equal((await reset({ userId: ids.member, newPassword: "unused-password-123" })).status, 403, "owner session, but the configured owner is someone else");
  process.env.OWNER_USER_ID = ids.owner;
  assert.notEqual(await auth.getSession(), null, "the session itself is unaffected");
});

test("owner reset: new password works, old one fails, the member's sessions end", { skip }, async () => {
  const memberSession = (await login(mail("member"), PW.member)).cookie;
  cookie = (await login(mail("owner"), PW.owner)).cookie;
  const NEW = `reset-pass-${run}-abc`;
  assert.equal((await reset({ userId: ids.member, newPassword: NEW })).status, 200);
  const h = await hashes(mail("member"));
  assert.equal(h.login, h.user, "both tables in step");
  assert.equal(await as(memberSession), null, "existing session ended");
  assert.equal((await login(mail("member"), PW.member)).status, 401, "old password refused");
  assert.equal((await login(mail("member"), NEW)).status, 200, "new password accepted");
  PW.member = NEW;
});

test("Settings change password: needs the current password, changes the login, keeps only this device", { skip }, async () => {
  const otherDevice = (await login(mail("staff"), PW.staff)).cookie;
  const thisDevice = (await login(mail("staff"), PW.staff)).cookie;
  cookie = thisDevice;
  const NEW = `self-change-${run}-abc`;
  assert.equal((await patchUser(ids.staff, { currentPassword: "not-my-password", password: NEW })).status, 403);
  const res = await patchUser(ids.staff, { currentPassword: PW.staff, password: NEW });
  assert.equal(res.status, 200);
  assert.equal(await as(otherDevice), null, "other device signed out");
  assert.equal(await as(thisDevice), null, "the old cookie on this device is replaced…");
  assert.equal((await as(res.cookies.get("admin_token")?.value))?.userId, ids.staff, "…by the fresh one, which works");
  assert.equal((await login(mail("staff"), PW.staff)).status, 401);
  assert.equal((await login(mail("staff"), NEW)).status, 200);
  const h = await hashes(mail("staff"));
  assert.equal(h.login, h.user);
  PW.staff = NEW;
});

test("owner email change moves the login; a clash rolls the whole change back", { skip }, async () => {
  cookie = (await login(mail("owner"), PW.owner)).cookie;
  assert.equal((await patchUser(ids.member, { email: mail("member2") })).status, 200);
  assert.equal((await login(mail("member2"), PW.member)).status, 200, "logs in with the new email");
  assert.equal((await login(mail("member"), PW.member)).status, 401, "not with the old one");

  // A login row already uses this email (no team row): the transaction must leave everything as it was.
  await prisma.adminUser.create({ data: { email: mail("orphan"), passwordHash: "x", name: "orphan" } });
  assert.equal((await patchUser(ids.member, { email: mail("orphan") })).status, 409);
  assert.equal((await prisma.user.findUnique({ where: { id: ids.member } })).email, mail("member2"), "team row unchanged");
  assert.equal((await login(mail("member2"), PW.member)).status, 200, "login row unchanged");
});

test("deactivating a member ends their session and blocks login", { skip }, async () => {
  const memberSession = (await login(mail("member2"), PW.member)).cookie;
  cookie = (await login(mail("owner"), PW.owner)).cookie;
  assert.equal((await patchUser(ids.member, { isActive: false })).status, 200);
  assert.equal(await as(memberSession), null);
  assert.equal((await login(mail("member2"), PW.member)).status, 403);
});

test("contract-signing tokens never authenticate admin APIs; sessions never sign contracts", { skip }, async () => {
  const ownerCookie = (await login(mail("owner"), PW.owner)).cookie;
  const contract = await prisma.contract.create({ data: { title: `IT contract ${run}` } });
  cookie = ownerCookie;
  const res = await signLinkRoute.POST(post(`http://x/api/admin/contracts/${contract.id}/sign-link`, {}), { params: Promise.resolve({ id: contract.id }) });
  assert.equal(res.status, 200);
  const { token } = await res.json();

  assert.equal(await as(token), null, "a signing token as the admin cookie gives no session");
  assert.equal((await usersRoute.GET()).status, 401, "and no admin data");
  const view = await signRoute.GET(new Request(`http://x/api/sign/${token}`), { params: Promise.resolve({ token }) });
  assert.equal(view.status, 200, "the signing link itself works");
  const asSign = await signRoute.GET(new Request("http://x/api/sign/s"), { params: Promise.resolve({ token: ownerCookie! }) });
  assert.equal(asSign.status, 401, "an admin session is not a signing link");
});

// ── S2: owner tier ────────────────────────────────────────────────────────────
const get = (url: string) => new Request(url);
const ownerCalls = (whId: string): [string, () => Promise<Response>][] => [
  ["export (prospects)", () => R.export.GET(get("http://x/api/admin/export?type=prospects"))],
  ["export/csv (leads)", () => R.csv.GET(get("http://x/api/admin/export/csv?type=leads"))],
  ["export/csv (clients)", () => R.csv.GET(get("http://x/api/admin/export/csv?type=clients"))],
  ["export/backup", () => R.backup.GET()],
  ["audit", () => R.audit.GET(get("http://x/api/admin/audit"))],
  ["debug", () => R.debug.GET()],
  ["webhooks GET", () => R.webhooks.GET()],
  ["webhooks POST", () => R.webhooks.POST(post("http://x/api/admin/webhooks", { name: "x", url: "https://example.test/x", events: "lead.new" }))],
  ["webhook PATCH", () => R.webhook.PATCH(post("http://x/api/admin/webhooks/w", { name: "renamed" }, "PATCH"), { params: Promise.resolve({ id: whId }) })],
  ["webhook DELETE", () => R.webhook.DELETE(new Request("http://x", { method: "DELETE" }), { params: Promise.resolve({ id: whId }) })],
  ["webhooks/test", () => R.webhookTest.POST(post("http://x/api/admin/webhooks/test", { id: whId }))],
];

test("exports, backup, audit, debug and webhooks: 401 signed out, 403 for a non-owner admin, open to the owner", { skip }, async () => {
  const wh = await prisma.webhook.create({ data: { name: `IT ${run}`, url: "https://example.test/hook", events: "lead.new", secret: `whsec-${run}` } });
  const staffCookie = (await login(mail("staff"), PW.staff)).cookie;
  assert.equal((await as(staffCookie))?.role, "admin", "the non-owner really has the admin role");
  const before = await prisma.webhook.findUnique({ where: { id: wh.id } });
  for (const [name, call] of ownerCalls(wh.id)) {
    cookie = undefined;
    assert.equal((await call()).status, 401, `${name}: signed out`);
    cookie = staffCookie;
    assert.equal((await call()).status, 403, `${name}: non-owner admin`);
  }
  assert.deepEqual(await prisma.webhook.findUnique({ where: { id: wh.id } }), before, "the refused calls changed nothing");
  assert.equal(await prisma.webhook.count({ where: { name: "x" } }), 0, "no webhook was created by the non-owner");

  cookie = (await login(mail("owner"), PW.owner)).cookie;
  for (const [name, call] of ownerCalls(wh.id).filter(([n]) => !/POST|PATCH|DELETE|webhooks\/test/.test(n))) {
    assert.equal((await call()).status, 200, `${name}: owner`);
  }
  const backup = await (await R.backup.GET()).text();
  assert.equal(/password_?hash/i.test(backup), false, "the backup never contains password hashes");
  await prisma.webhook.delete({ where: { id: wh.id } });
});

test("webhook signing secrets never leave the server; tests use the stored secret", { skip }, async () => {
  cookie = (await login(mail("owner"), PW.owner)).cookie;
  const SECRET = `whsec-never-shown-${run}`;
  const created = await R.webhooks.POST(post("http://x/api/admin/webhooks", { name: `IT2 ${run}`, url: "https://example.test/h2", events: "lead.new", secret: SECRET }));
  assert.equal(created.status, 201);
  const c = await created.text();
  assert.equal(c.includes(SECRET), false, "create response");
  const id = JSON.parse(c).id;
  assert.equal(JSON.parse(c).hasSecret, true);

  const list = await (await R.webhooks.GET()).text();
  assert.equal(list.includes(SECRET), false, "listing");
  assert.equal(list.includes('"secret"'), false, "no secret field at all in the listing");

  const patched = await (await R.webhook.PATCH(post("http://x", { name: `IT2 renamed ${run}` }, "PATCH"), { params: Promise.resolve({ id }) })).text();
  assert.equal(patched.includes(SECRET), false, "update response");
  assert.equal((await prisma.webhook.findUnique({ where: { id } })).secret, SECRET, "a blank secret in the form keeps the stored one");

  assert.equal((await R.webhookTest.POST(post("http://x", { url: "https://evil.test", secret: "x" }))).status, 400, "ad-hoc URLs are no longer accepted");
  assert.equal((await R.webhookTest.POST(post("http://x", { id: "missing" }))).status, 404);
  assert.equal((await R.webhook.DELETE(new Request("http://x", { method: "DELETE" }), { params: Promise.resolve({ id }) })).status, 200);
});

test("ordinary CRM access is unchanged for non-owner team members", { skip }, async () => {
  cookie = (await login(mail("staff"), PW.staff)).cookie;
  assert.equal((await R.leads.GET(get("http://x/api/admin/leads"))).status, 200, "leads");
  assert.equal((await R.clients.GET(get("http://x/api/admin/clients"))).status, 200, "clients");
  assert.equal((await R.prospecting.GET(get("http://x/api/admin/prospecting"))).status, 200, "prospects");
});
