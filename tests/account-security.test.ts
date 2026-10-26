/**
 * Password changes and owner-only account management. The owner is the User row named by
 * OWNER_USER_ID (checked against the database), never the role or email claimed by a token.
 * Password changes must update the LOGIN password (admin_users) and end old sessions.
 * Real auth + routes; Prisma, cookies and the audit log are mocked in memory (no database).
 * Needs --experimental-test-module-mocks (see the "test" script).
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import bcrypt from "bcryptjs";

process.env.JWT_SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";

type U = { id: string; email: string; fullName: string; role: string; avatarInitials: string; isActive: boolean; passwordHash: string; createdAt: Date };
let users: U[] = [];
let logins: { email: string; passwordHash: string }[] = [];
let cookie: string | undefined;
const audits: string[] = [];

const pick = (row: U | undefined, select?: Record<string, boolean>) =>
  !row ? null : select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k as keyof U]])) : { ...row };
const db = {
  user: {
    findUnique: async ({ where, select }: { where: { id?: string; email?: string }; select?: Record<string, boolean> }) =>
      pick(users.find((u) => (where.id !== undefined ? u.id === where.id : u.email === where.email)), select),
    update: async ({ where, data, select }: { where: { id: string }; data: Partial<U>; select?: Record<string, boolean> }) => {
      const u = users.find((x) => x.id === where.id);
      if (!u) throw new Error("not found");
      if (data.email && users.some((x) => x.email === data.email && x !== u)) throw new Error("unique");
      Object.assign(u, data);
      return pick(u, select);
    },
  },
  adminUser: {
    findUnique: async ({ where }: { where: { email: string } }) => {
      const l = logins.find((x) => x.email === where.email);
      return l ? { ...l } : null;
    },
    updateMany: async ({ where, data }: { where: { email: string }; data: { passwordHash?: string; email?: string } }) => {
      if (data.email && logins.some((x) => x.email === data.email)) throw new Error("unique");
      const hit = logins.filter((x) => x.email === where.email);
      hit.forEach((x) => Object.assign(x, data));
      return { count: hit.length };
    },
  },
  $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
};

mock.module("next/headers", {
  namedExports: { cookies: async () => ({ get: (n: string) => (n === "admin_token" && cookie ? { name: n, value: cookie } : undefined) }) },
});
mock.module("@/lib/prisma", { namedExports: { prisma: db, hasPrisma: () => true } });
mock.module("@/lib/audit", { namedExports: { getClientIp: () => "127.0.0.1", logAudit: async (a: { action: string }) => { audits.push(a.action); } } });
mock.module("@/lib/dal", {
  namedExports: {
    getUsers: async () => users.map((u) => ({ ...u, passwordHash: undefined })),
    createUser: async (d: { email: string }) => ({ id: "u-new", email: d.email }),
  },
});

let auth: typeof import("../src/lib/auth");
let sec: typeof import("../src/lib/account-security");
let userRoute: typeof import("../src/app/api/admin/users/[id]/route");
let usersRoute: typeof import("../src/app/api/admin/users/route");
let resetRoute: typeof import("../src/app/api/admin/reset-password/route");
const PW: Record<string, string> = {};
const HASH: Record<string, string> = {};
before(async () => {
  auth = await import("../src/lib/auth");
  sec = await import("../src/lib/account-security");
  userRoute = await import("../src/app/api/admin/users/[id]/route");
  usersRoute = await import("../src/app/api/admin/users/route");
  resetRoute = await import("../src/app/api/admin/reset-password/route");
  for (const who of ["owner", "staff", "off"]) {
    PW[who] = `fixture-${who}-password-1`;
    HASH[who] = await bcrypt.hash(PW[who], 4);
  }
});

const mk = (id: string, email: string, role: string, isActive = true): U =>
  ({ id, email, fullName: id, role, avatarInitials: "XX", isActive, passwordHash: "unused-copy", createdAt: new Date(0) });
beforeEach(() => {
  process.env.OWNER_USER_ID = "u-owner";
  // Every account is "admin" in the database, as in production today: the role must not decide ownership.
  users = [mk("u-owner", "owner@x.ma", "admin"), mk("u-staff", "staff@x.ma", "admin"), mk("u-off", "off@x.ma", "admin", false)];
  logins = [
    { email: "owner@x.ma", passwordHash: HASH.owner },
    { email: "staff@x.ma", passwordHash: HASH.staff },
    { email: "off@x.ma", passwordHash: HASH.off },
  ];
  cookie = undefined;
  audits.length = 0;
});

const loginHash = (email: string) => logins.find((l) => l.email === email)!.passwordHash;
/** Sign in as a user the way the login route does, optionally claiming a different role. */
async function as(id: string, role?: string) {
  const u = users.find((x) => x.id === id)!;
  cookie = await auth.signToken({ userId: u.id, email: u.email, fullName: u.fullName, role: role ?? u.role, avatarInitials: u.avatarInitials }, loginHash(u.email));
  return cookie;
}
const json = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const patch = (id: string, body: unknown) =>
  userRoute.PATCH(new Request(`http://x/api/admin/users/${id}`, { ...json(body), method: "PATCH" }), { params: Promise.resolve({ id }) });
const reset = (body: unknown) => resetRoute.POST(new Request("http://x/api/admin/reset-password", json(body)));
const create = (body: unknown) => usersRoute.POST(new Request("http://x/api/admin/users", json(body)));
const NEW = "a-brand-new-password-42";

test("a non-owner admin cannot reset, create or manage anyone, including the owner", async () => {
  await as("u-staff");
  const ownerBefore = loginHash("owner@x.ma");
  assert.equal((await reset({ userId: "u-owner", newPassword: NEW })).status, 403, "reset the owner");
  assert.equal((await reset({ userId: "u-staff", newPassword: NEW })).status, 403, "reset-password route, even for self");
  assert.equal((await patch("u-owner", { password: NEW })).status, 403, "set the owner's password");
  assert.equal((await patch("u-owner", { email: "staff2@x.ma" })).status, 403, "change the owner's email");
  assert.equal((await patch("u-off", { isActive: true })).status, 403, "reactivate a disabled account");
  assert.equal((await patch("u-owner", { fullName: "x" })).status, 403, "edit another user's profile");
  assert.equal((await patch("u-staff", { role: "admin" })).status, 403, "change own role");
  assert.equal((await patch("u-staff", { email: "owner2@x.ma" })).status, 403, "change own email");
  assert.equal((await create({ fullName: "N", email: "n@x.ma", password: NEW, role: "admin", avatarInitials: "N" })).status, 403, "add a team member");
  assert.equal(loginHash("owner@x.ma"), ownerBefore);
  assert.equal(users.find((u) => u.id === "u-off")!.isActive, false);
  assert.deepEqual(audits, []);
});

test("ownership comes from OWNER_USER_ID and the database, not the token's role or claimed identity", async () => {
  await as("u-owner", "sales");
  assert.equal((await reset({ userId: "u-staff", newPassword: NEW })).status, 200, "owner with a 'sales' role claim is still owner");
  await as("u-staff", "owner");
  assert.equal((await reset({ userId: "u-owner", newPassword: NEW })).status, 403, "a staff token claiming any role is not owner");
  const session = { userId: "u-owner", email: "staff@x.ma", fullName: "x", role: "admin", avatarInitials: "X" };
  assert.equal(await sec.isOwner(session), false, "owner id paired with another email");
  users.find((u) => u.id === "u-owner")!.isActive = false;
  assert.equal(await sec.isOwner({ ...session, email: "owner@x.ma" }), false, "deactivated owner row");
});

test("owner-only actions fail closed when OWNER_USER_ID is missing or unknown", async () => {
  await as("u-owner");
  delete process.env.OWNER_USER_ID;
  assert.equal((await reset({ userId: "u-staff", newPassword: NEW })).status, 403);
  process.env.OWNER_USER_ID = "u-nobody";
  assert.equal((await patch("u-staff", { isActive: false })).status, 403);
});

test("an owner reset changes the real login password and ends that user's sessions", async () => {
  const staffSession = await as("u-staff");
  await as("u-owner");
  assert.equal((await reset({ userId: "u-staff", newPassword: "too-short" })).status, 400, "12-character minimum");
  const res = await reset({ userId: "u-staff", newPassword: NEW });
  assert.equal(res.status, 200);
  assert.equal(await sec.checkLoginPassword("staff@x.ma", NEW), true, "the login accepts the new password");
  assert.equal(await sec.checkLoginPassword("staff@x.ma", PW.staff), false, "and no longer the old one");
  assert.equal(users.find((u) => u.id === "u-staff")!.passwordHash, loginHash("staff@x.ma"), "both tables in step");
  assert.deepEqual(audits, ["RESET_PASSWORD"]);
  cookie = staffSession;
  assert.equal(await auth.getSession(), null, "the staff member's existing session is over");
});

test("Settings → Change password changes the login password and keeps only this device signed in", async () => {
  const oldSession = await as("u-staff");
  assert.equal((await patch("u-staff", { password: NEW })).status, 403, "current password required");
  assert.equal((await patch("u-staff", { currentPassword: "wrong-password-123", password: NEW })).status, 403, "wrong current password");
  assert.equal(await sec.checkLoginPassword("staff@x.ma", PW.staff), true, "nothing changed yet");
  assert.equal((await patch("u-staff", { currentPassword: PW.staff, password: "short" })).status, 400, "12-character minimum");

  const res = await patch("u-staff", { currentPassword: PW.staff, password: NEW });
  assert.equal(res.status, 200);
  assert.equal(await sec.checkLoginPassword("staff@x.ma", NEW), true, "the login password really changed");
  assert.equal(await sec.checkLoginPassword("staff@x.ma", PW.staff), false);
  assert.deepEqual(audits, ["CHANGE_PASSWORD"]);

  cookie = oldSession;
  assert.equal(await auth.getSession(), null, "the session issued for the old password is over");
  cookie = res.cookies.get("admin_token")?.value;
  assert.equal((await auth.getSession())?.userId, "u-staff", "the fresh cookie returned to this device works");
});

test("anyone can edit their own name and initials; the owner can manage others but not lock themselves out", async () => {
  await as("u-staff");
  assert.equal((await patch("u-staff", { fullName: "Staff Renamed", avatarInitials: "SR" })).status, 200);
  assert.equal(users.find((u) => u.id === "u-staff")!.fullName, "Staff Renamed");

  await as("u-owner");
  assert.equal((await patch("u-owner", { isActive: false })).status, 400, "owner cannot deactivate themselves");
  assert.equal((await patch("u-staff", { isActive: false, role: "sales" })).status, 200);
  assert.deepEqual(audits, ["UPDATE_USER"]);
  assert.equal((await create({ fullName: "N", email: "n@x.ma", password: NEW, role: "sales", avatarInitials: "N" })).status, 201);
});

test("an owner email change moves the login row with it, and duplicates are refused", async () => {
  await as("u-owner");
  assert.equal((await patch("u-staff", { email: "staff.new@x.ma" })).status, 200);
  assert.equal(logins.some((l) => l.email === "staff.new@x.ma"), true, "login row follows the new email");
  assert.equal(await sec.checkLoginPassword("staff.new@x.ma", PW.staff), true);
  assert.equal((await patch("u-staff", { email: "off@x.ma" })).status, 409, "email already used");
});

test("the seed API that reset every team password is gone", () => {
  assert.equal(existsSync(new URL("../src/app/api/admin/seed/route.ts", import.meta.url)), false);
});
