/**
 * Five-section navigation. Pure, no database: reads the nav config and the
 * admin folder to prove the menu is small and no page became unreachable.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { MAIN_NAV, MORE_GROUPS, activeTab, sectionForPath } from "../src/lib/admin-nav";

const url = (rel: string) => new URL(`../${rel}`, import.meta.url);
const tabLinks = MAIN_NAV.flatMap((s) => s.tabs.map((t) => t.href));
const moreLinks = MORE_GROUPS.flatMap((g) => g.links.map((l) => l.href));
const allLinks = [...MAIN_NAV.map((s) => s.href), ...tabLinks, ...moreLinks];

test("the menu is exactly Today, Leads, Clients, Money, More", () => {
  assert.deepEqual(MAIN_NAV.map((s) => s.label), ["Today", "Leads", "Clients", "Money", "More"]);
});

test("every admin page is reachable from the menu, a tab or More", () => {
  const notTools = new Set(["login", "more", "workspace"]); // sign-in, this page, and per-record screens
  const pages = readdirSync(url("src/app/admin"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !notTools.has(d.name) && existsSync(url(`src/app/admin/${d.name}/page.tsx`)))
    .map((d) => `/admin/${d.name}`);
  assert.ok(pages.length > 25, "admin folder not read");
  for (const page of pages) assert.ok(allLinks.includes(page), `${page} is not linked`);
});

test("every link points at a page that exists", () => {
  for (const href of allLinks) {
    const rel = href === "/admin" ? "src/app/admin/page.tsx" : `src/app${href}/page.tsx`;
    assert.ok(existsSync(url(rel)), `${href} has no page`);
  }
});

test("no tool is listed twice", () => {
  assert.equal(new Set([...tabLinks, ...moreLinks]).size, tabLinks.length + moreLinks.length);
});

test("pages land in the right section, including detail pages", () => {
  const cases: Record<string, string> = {
    "/admin": "today",
    "/admin/prospecting": "leads",
    "/admin/prospecting/abc": "leads",
    "/admin/workspace/prospect/abc": "leads",
    "/admin/inbox": "leads",
    "/admin/leads/abc": "leads",
    "/admin/discovery": "leads",
    "/admin/clients/abc": "clients",
    "/admin/pipeline": "clients",
    "/admin/tasks": "clients",
    "/admin/meetings": "clients",
    "/admin/invoices": "money",
    "/admin/revenue": "money",
    "/admin/contracts": "money",
    "/admin/more": "more",
    "/admin/settings": "more",
    "/admin/projects/abc/edit": "more",
    "/admin/prospect-discovery": "more", // must not be caught by /admin/prospecting or /admin/leads
  };
  for (const [path, key] of Object.entries(cases)) assert.equal(sectionForPath(path).key, key, path);
});

test("tabs appear only where a tab matches", () => {
  assert.equal(activeTab("/admin/clients/abc")?.href, "/admin/clients");
  assert.equal(activeTab("/admin/revenue")?.label, "Revenue");
  assert.equal(activeTab("/admin"), null);
  assert.equal(activeTab("/admin/more"), null);
  assert.equal(activeTab("/admin/workspace/prospect/abc"), null);
});

test("on phones only the Prospects list hides its heading, and the phone bar names the section", () => {
  const flagged = MAIN_NAV.flatMap((s) => s.tabs).filter((t) => t.hideTitleOnPhone).map((t) => t.href);
  assert.deepEqual(flagged, ["/admin/prospecting"]);
  assert.equal(activeTab("/admin/prospecting")?.label, "All prospects");
  const src = readFileSync(url("src/app/admin/layout.tsx"), "utf8");
  // Exact page only, so a prospect's own page keeps its name; visually hidden, so screen readers still get it.
  assert.match(src, /SIMPLE_NAV && tab\?\.hideTitleOnPhone && pathname === tab\.href && "max-lg:\[&_h1\]:sr-only"/);
  assert.match(src, /SIMPLE_NAV && tab \? sectionForPath\(pathname\)\.label : getPageTitle\(pathname\)/);
});

test("sidebar text uses theme tokens, so dark mode can reach it", () => {
  const src = readFileSync(url("src/app/admin/layout.tsx"), "utf8");
  assert.doesNotMatch(src, /text-\[#(0F172A|475569|64748B|94A3B8)\]/);
  const css = readFileSync(url("src/app/globals.css"), "utf8");
  assert.equal((css.match(/--os-hover:/g) ?? []).length, 2, "--os-hover needs a light and a dark value");
});

test("the classic sidebar stays one switch away and the login page keeps no menu", () => {
  const src = readFileSync(url("src/app/admin/layout.tsx"), "utf8");
  assert.match(src, /const SIMPLE_NAV = true;/);
  assert.match(src, /SIMPLE_NAV\s*\?\s*\[\{ label: "", items: SIMPLE_ITEMS \}\]\s*:\s*FOCUS_MODE/);
  assert.match(src, /if \(isLogin\) return <>\{children\}<\/>;/);
});
