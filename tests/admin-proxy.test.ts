/** /admin pages are gated server-side by proxy.ts (T010, T044): no valid token, no admin shell. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import proxy from "../src/proxy";

process.env.JWT_SECRET = "t".repeat(40);

const req = (path: string, token?: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: token ? { cookie: `admin_token=${token}` } : {} });
const location = (res: Response) => res.headers.get("location");

test("admin pages redirect to the login page without a token", async () => {
  for (const p of ["/admin", "/admin/leads", "/admin/prospecting/abc", "/admin/settings"]) {
    const res = await proxy(req(p));
    assert.equal(res.status, 307, p);
    assert.equal(new URL(location(res)!).pathname, "/admin/login", p);
  }
});

test("a garbage or foreign-purpose token is not a session", async () => {
  assert.equal((await proxy(req("/admin", "abc"))).status, 307);
  const key = new TextEncoder().encode(process.env.JWT_SECRET);
  const unsigned = await new SignJWT({ userId: "u1", email: "a@b.c", role: "admin" }).setProtectedHeader({ alg: "HS256" }).sign(key);
  assert.equal((await proxy(req("/admin/leads", unsigned))).status, 307, "a token not minted for the admin session must be refused");
});

test("the login page stays reachable without a token", async () => {
  const res = await proxy(req("/admin/login"));
  assert.notEqual(res.status, 307);
  assert.equal(location(res), null);
});

test("a genuine session token lets the page through", async () => {
  const { signToken } = await import("../src/lib/auth");
  const token = await signToken({ userId: "u1", email: "a@b.c", fullName: "A", role: "admin", avatarInitials: "A" }, "hash");
  const res = await proxy(req("/admin/leads", token));
  assert.notEqual(res.status, 307);
  assert.equal(location(res), null);
});
