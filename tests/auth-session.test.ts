/**
 * Admin-session authentication must fail closed. Only an admin-session token (its own typ, audience,
 * issuer and derived key) whose userId points at an active User with the same email, issued for that
 * account's current login password, gets a session.
 * Contract-signing links, legacy tokens, malformed or expired tokens, and any database problem never do.
 * Cookies and Prisma are mocked; no database. Needs --experimental-test-module-mocks (see "test").
 */
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { SignJWT } from "jose";

const SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
process.env.JWT_SECRET = SECRET;

type Row = { email: string; isActive: boolean; role: string; fullName: string; avatarInitials: string } | null;
let cookie: string | undefined;
let dbUp = true;
let row: Row = null;
let login: { passwordHash: string } | null = null;
let dbError: Error | null = null;
const lookups: unknown[] = [];

mock.module("next/headers", {
  namedExports: { cookies: async () => ({ get: (n: string) => (n === "admin_token" && cookie !== undefined ? { name: n, value: cookie } : undefined) }) },
});
mock.module("@/lib/prisma", {
  namedExports: {
    hasPrisma: () => dbUp,
    prisma: {
      user: {
        findUnique: async (args: { where: { id?: unknown } }) => {
          lookups.push(args.where.id);
          if (dbError) throw dbError;
          return row;
        },
      },
      adminUser: {
        findUnique: async () => {
          if (dbError) throw dbError;
          return login;
        },
      },
      contract: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === "c123" ? { id: "c123", title: "T", amount: 1, currency: "MAD", paymentTerms: "", notes: "", startDate: null, endDate: null, status: "PENDING_SIGNATURE", client: null, prospect: null } : null,
      },
    },
  },
});

let auth: typeof import("../src/lib/auth");
let authz: typeof import("../src/lib/authz");
let signRoute: typeof import("../src/app/api/sign/[token]/route");
before(async () => {
  auth = await import("../src/lib/auth");
  authz = await import("../src/lib/authz");
  signRoute = await import("../src/app/api/sign/[token]/route");
});

const user = { userId: "u1", email: "owner@x.ma", fullName: "Owner", role: "admin", avatarInitials: "OW" };
const HASH = "$2b$12$fixture-current-login-hash";
beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
  cookie = undefined; dbUp = true; dbError = null; lookups.length = 0;
  row = { email: user.email, isActive: true, role: user.role, fullName: user.fullName, avatarInitials: user.avatarInitials };
  login = { passwordHash: HASH };
});

const key = (purpose: string, secret = SECRET) => new Uint8Array(createHmac("sha256", secret).update(`ibda3:jwt:${purpose}:v1`).digest());
const stamp = (hash = HASH) => createHmac("sha256", key("session")).update(`pwd:${hash}`).digest("base64url").slice(0, 22);
/** A token signed with the real session key but hand-built claims, to test claim checks. */
const forge = (claims: Record<string, unknown>, o: { typ?: string; aud?: string; iss?: string; exp?: number | string; sub?: string; purpose?: string } = {}) => {
  const j = new SignJWT(claims).setProtectedHeader({ alg: "HS256", typ: o.typ ?? "admin-session+jwt" })
    .setIssuer(o.iss ?? "ibda3digital").setAudience(o.aud ?? "ibda3-admin").setIssuedAt().setExpirationTime(o.exp ?? "1h");
  if (o.sub !== undefined) j.setSubject(o.sub);
  return j.sign(key(o.purpose ?? "session"));
};
const session = async (token: string | undefined) => { cookie = token; return auth.getSession(); };
const signGet = (token: string) => signRoute.GET(new Request(`http://x/api/sign/${token}`), { params: Promise.resolve({ token }) });

test("a real admin-session token for an active user gets a session", async () => {
  const s = await session(await auth.signToken(user, HASH));
  assert.deepEqual(s, user);
  assert.deepEqual(lookups, ["u1"]);
});

test("a contract-signing link token is never an admin session", async () => {
  const signLink = await auth.signContractToken("c123");
  assert.equal(await auth.verifyToken(signLink), null);
  assert.equal(await session(signLink), null);
  assert.deepEqual(lookups, [], "rejected before any database lookup");
});

test("legacy tokens signed with the raw JWT_SECRET (old sign links and old sessions) are rejected", async () => {
  const raw = new TextEncoder().encode(SECRET);
  const oldLink = await new SignJWT({ contractId: "c123" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(raw);
  const oldSession = await new SignJWT({ ...user }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(raw);
  assert.equal(await session(oldLink), null);
  assert.equal(await session(oldSession), null);
  assert.equal((await signGet(oldLink)).status, 401, "old sign links stop working too");
});

test("a sign-link-shaped payload is rejected even when signed with the session key", async () => {
  assert.equal(await session(await forge({ contractId: "c123" }, { sub: "c123" })), null);
});

test("session tokens need a non-empty string userId that matches sub, plus email and role", async () => {
  const good = { ...user, pwd: stamp() };
  const cases: [string, Record<string, unknown>, string | undefined][] = [
    ["no userId", { ...good, userId: undefined }, "u1"],
    ["numeric userId", { ...good, userId: 1 }, "u1"],
    ["empty userId", { ...good, userId: "" }, ""],
    ["object userId (query injection)", { ...good, userId: { not: "" } }, "u1"],
    ["sub mismatch", good, "u2"],
    ["no sub", good, undefined],
    ["no email", { ...good, email: undefined }, "u1"],
    ["no role", { ...good, role: "" }, "u1"],
    ["no password stamp", { ...good, pwd: undefined }, "u1"],
  ];
  for (const [name, claims, sub] of cases) {
    assert.equal(await session(await forge(claims, { sub })), null, name);
  }
  assert.deepEqual(lookups, [], "none of them reached the database");
  assert.deepEqual(await session(await forge(good, { sub: "u1" })), user, "control: the same claims, well-formed, are accepted");
});

test("wrong typ, audience, issuer, purpose key or secret are rejected", async () => {
  const c = { ...user, pwd: stamp() };
  assert.equal(await session(await forge(c, { sub: "u1", typ: "JWT" })), null, "typ");
  assert.equal(await session(await forge(c, { sub: "u1", aud: "ibda3-contract-sign" })), null, "audience");
  assert.equal(await session(await forge(c, { sub: "u1", iss: "elsewhere" })), null, "issuer");
  assert.equal(await session(await forge(c, { sub: "u1", purpose: "contractSign" })), null, "contract key");
  process.env.JWT_SECRET = "another-secret-0123456789-abcdefghijklmnopq";
  const other = await auth.signToken(user, HASH);
  process.env.JWT_SECRET = SECRET;
  assert.equal(await session(other), null, "token from a different secret (e.g. a preview environment)");
});

test("malformed tokens are rejected", async () => {
  const unsigned = Buffer.from(JSON.stringify({ alg: "none", typ: "admin-session+jwt" })).toString("base64url") + "." +
    Buffer.from(JSON.stringify({ ...user, sub: "u1", aud: "ibda3-admin", iss: "ibda3digital" })).toString("base64url") + ".";
  for (const t of ["", "garbage", "a.b.c", "....", unsigned]) {
    assert.equal(await session(t), null, JSON.stringify(t));
  }
});

test("expired tokens are rejected", async () => {
  assert.equal(await session(await forge({ ...user, pwd: stamp() }, { sub: "u1", exp: Math.floor(Date.now() / 1000) - 60 })), null);
});

test("a new login password ends every session issued for the old one", async () => {
  const t = await auth.signToken(user, HASH);
  assert.deepEqual(await session(t), user);
  login = { passwordHash: "$2b$12$fixture-new-login-hash" };
  assert.equal(await session(t), null, "old session after a password change");
  assert.deepEqual(await session(await auth.signToken(user, "$2b$12$fixture-new-login-hash")), user, "a session for the new password works");
  login = null;
  assert.equal(await session(t), null, "no login account any more");
  await assert.rejects(auth.signToken(user, ""), "a session cannot be issued without the password hash");
});

test("database problems fail closed", async () => {
  const t = await auth.signToken(user, HASH);
  dbUp = false;
  assert.equal(await session(t), null, "no database configured");
  dbUp = true;
  dbError = Object.assign(new Error("validation"), { name: "PrismaClientValidationError" });
  assert.equal(await session(t), null, "Prisma validation error");
  dbError = new Error("connection reset");
  assert.equal(await session(t), null, "transient connection error");
  dbError = null;
  assert.deepEqual(await session(t), user, "and works again once the database is back");
});

test("a missing, inactive or different user gets no session", async () => {
  const t = await auth.signToken(user, HASH);
  row = null;
  assert.equal(await session(t), null, "user deleted");
  row = { email: user.email, isActive: false, role: user.role, fullName: user.fullName, avatarInitials: user.avatarInitials };
  assert.equal(await session(t), null, "user deactivated");
  row = { email: "someone-else@x.ma", isActive: true, role: "admin", fullName: "Other", avatarInitials: "OT" };
  assert.equal(await session(t), null, "userId now belongs to another email");
});

test("no cookie or no JWT_SECRET means no session, and no token can be minted without a secret", async () => {
  assert.equal(await session(undefined), null);
  const t = await auth.signToken(user, HASH);
  delete process.env.JWT_SECRET;
  assert.equal(await session(t), null);
  await assert.rejects(auth.signToken(user, HASH));
  await assert.rejects(auth.signContractToken("c123"));
  process.env.JWT_SECRET = "too-short";
  assert.equal(await session(t), null, "secrets under 32 characters are refused");
});

test("the public signing endpoint accepts sign links but never admin-session tokens", async () => {
  assert.equal((await signGet(await auth.signContractToken("c123"))).status, 200);
  assert.equal((await signGet(await auth.signToken(user, HASH))).status, 401);
  assert.equal(await auth.verifyContractToken(await auth.signToken(user, HASH)), null);
});

test("role, name and initials come from the database on every request, never from the token", async () => {
  const t = await auth.signToken(user, HASH); // token claims role "admin"
  row = { ...row!, role: " Sales ", fullName: "Renamed Owner", avatarInitials: "RO" };
  const s = await session(t);
  assert.equal(s?.role, "sales", "database role, normalised (trimmed, lower-case)");
  assert.equal(s?.fullName, "Renamed Owner");
  assert.equal(s?.avatarInitials, "RO");
  assert.equal(authz.isAdmin(s), false, "the token's admin claim grants nothing");
  row = { ...row!, role: "ADMIN" };
  assert.equal(authz.isAdmin(await session(t)), true, "a role change applies on the next request, no re-login");
});

test("requireTeam / requireAdmin / requireOwner: 401 without a session, 403 without the tier", async () => {
  const t = await auth.signToken(user, HASH);
  cookie = undefined;
  for (const guard of [authz.requireTeam, authz.requireAdmin, authz.requireOwner]) {
    assert.equal((await guard()).response?.status, 401);
  }
  cookie = t;
  row = { ...row!, role: "sales" };
  assert.equal((await authz.requireTeam()).session?.userId, "u1", "any active member passes team");
  assert.equal((await authz.requireAdmin()).response?.status, 403, "sales is not admin");
  row = { ...row!, role: "admin" };
  assert.equal((await authz.requireAdmin()).session?.userId, "u1");
  delete process.env.OWNER_USER_ID;
  assert.equal((await authz.requireOwner()).response?.status, 403, "no OWNER_USER_ID → nobody is owner");
  process.env.OWNER_USER_ID = "someone-else";
  assert.equal((await authz.requireOwner()).response?.status, 403, "admin role is not ownership");
  process.env.OWNER_USER_ID = "u1";
  assert.equal((await authz.requireOwner()).session?.userId, "u1", "the configured owner row passes");
  delete process.env.OWNER_USER_ID;
});

test("no hard-coded role map remains, and no route compares session.role inline", async () => {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = new URL("../src/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const files: string[] = [];
  (function walk(d: string) {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { if (f !== "generated") walk(p); } else if (/\.(ts|tsx)$/.test(f)) files.push(p);
    }
  })(root);
  assert.ok(files.length > 100, `scanned ${files.length} source files`);
  const offenders = files.filter((f) => /ROLE_MAP|session\??\.role\s*[!=]==?\s*["']/.test(readFileSync(f, "utf8")));
  assert.deepEqual(offenders, []);
});
