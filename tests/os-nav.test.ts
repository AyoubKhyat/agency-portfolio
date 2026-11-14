/**
 * Client Acquisition navigation. Pure, no database: reads the nav config and the
 * admin folder to prove no page became unreachable, every link (including its
 * query filter) is real, and query-aware active states pick the right entry.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { MAIN_NAV, MORE_GROUPS, activeTab, hrefPath, sectionForPath } from "../src/lib/admin-nav";

const url = (rel: string) => new URL(`../${rel}`, import.meta.url);
const tabLinks = MAIN_NAV.flatMap((s) => s.tabs.map((t) => t.href));
const moreLinks = MORE_GROUPS.flatMap((g) => g.links.map((l) => l.href));
const allLinks = [...MAIN_NAV.map((s) => s.href), ...tabLinks, ...moreLinks, ...MAIN_NAV.flatMap((s) => s.alsoMatches ?? [])];
const allPaths = allLinks.map(hrefPath);

test("the menu is Client acquisition, then Business, then More", () => {
  const byGroup = (g: string) => MAIN_NAV.filter((s) => s.group === g).map((s) => s.label);
  assert.deepEqual(byGroup("acquisition"), ["Today", "Find", "Qualify", "Contact", "Follow Up", "Close", "All Prospects"]);
  assert.deepEqual(byGroup("business"), ["Clients", "Projects", "Invoices", "Revenue"]);
  assert.deepEqual(byGroup("more"), ["More tools", "Settings"]);
  assert.equal(MAIN_NAV.length, 13);
});

test("P6C finder leads Find, P6A sits under Qualify, P6B stays on the prospect page", () => {
  const find = MAIN_NAV.find((s) => s.key === "find")!;
  assert.equal(find.href, "/admin/batch-discovery");
  assert.equal(find.tabs[0].href, "/admin/batch-discovery");
  assert.equal(MAIN_NAV.find((s) => s.key === "qualify")!.href, "/admin/qualify");
  assert.match(readFileSync(url("src/app/admin/prospecting/[id]/page.tsx"), "utf8"), /OutreachDraftPanel/);
  assert.equal(sectionForPath("/admin/prospecting/abc").key, "prospects");
});

test("every admin page is reachable from the menu, a tab or More", () => {
  const notTools = new Set(["login", "more", "workspace"]); // sign-in, More itself, and per-record screens
  const pages = readdirSync(url("src/app/admin"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !notTools.has(d.name) && existsSync(url(`src/app/admin/${d.name}/page.tsx`)))
    .map((d) => `/admin/${d.name}`);
  assert.ok(pages.length > 25, "admin folder not read");
  for (const page of pages) assert.ok(allPaths.includes(page), `${page} is not linked`);
});

test("every link points at a page that exists", () => {
  for (const href of allPaths) {
    if (href.startsWith("/admin/workspace/")) continue; // per-record screens: /admin/workspace/<kind>/[id]
    const rel = href === "/admin" ? "src/app/admin/page.tsx" : `src/app${href}/page.tsx`;
    assert.ok(existsSync(url(rel)), `${href} has no page`);
  }
  for (const kind of ["discovery", "prospect"]) assert.ok(existsSync(url(`src/app/admin/workspace/${kind}/[id]/page.tsx`)));
});

test("query filters are ones the target page already reads", () => {
  const queue = readFileSync(url("src/app/admin/lead-queue/page.tsx"), "utf8");
  const prospecting = readFileSync(url("src/app/admin/prospecting/page.tsx"), "utf8");
  const stages = readFileSync(url("src/lib/prospect-stages.ts"), "utf8");
  for (const href of allLinks.filter((h) => h.includes("?"))) {
    const params = new URLSearchParams(href.split("?")[1]);
    if (hrefPath(href) === "/admin/lead-queue") {
      assert.deepEqual([...params.keys()], ["view"], href);
      assert.match(queue, new RegExp(`view === "${params.get("view")}"`), href);
    } else if (hrefPath(href) === "/admin/prospecting") {
      assert.deepEqual([...params.keys()], ["status"], href);
      assert.match(prospecting, /searchParams\.get\("status"\)/);
      for (const st of params.get("status")!.split(",")) assert.match(stages, new RegExp(`"${st}"`), `${href}: ${st}`);
    } else {
      assert.fail(`${href}: no known filter`);
    }
  }
  // The queue follows the URL on every visit, so Contact → Follow Up changes the view without a reload.
  assert.match(queue, /useSearchParams\(\)\.get\("view"\)/);
});

test("no tool is listed twice", () => {
  assert.equal(new Set([...tabLinks, ...moreLinks]).size, tabLinks.length + moreLinks.length);
  const sidebar = MAIN_NAV.map((s) => s.href);
  for (const href of moreLinks) assert.ok(!sidebar.includes(href), `${href} is in the menu and in More`);
});

test("pages land in the right section, using the query string where pages are shared", () => {
  const cases: [string, string, string][] = [
    ["/admin", "", "today"],
    ["/admin/batch-discovery", "", "find"],
    ["/admin/discovery", "", "find"],
    ["/admin/workspace/discovery/abc", "", "find"],
    ["/admin/qualify", "", "qualify"],
    ["/admin/lead-queue", "", "contact"],
    ["/admin/lead-queue", "view=ready", "contact"],
    ["/admin/outreach", "", "contact"],
    ["/admin/lead-queue", "view=followUps", "followUp"],
    ["/admin/lead-queue", "view=replies", "followUp"],
    ["/admin/inbox", "", "followUp"],
    ["/admin/prospecting", "status=MEETING,PROPOSAL_SENT,NEGOTIATION", "close"],
    ["/admin/meetings", "scope=today", "close"],
    ["/admin/contracts", "", "close"],
    ["/admin/prospecting", "", "prospects"],
    ["/admin/prospecting", "status=A_ENVOYER&channel=verified", "prospects"],
    ["/admin/prospecting", "status=MEETING", "prospects"],
    ["/admin/prospecting/abc", "status=MEETING,PROPOSAL_SENT,NEGOTIATION", "prospects"],
    ["/admin/workspace/prospect/abc", "", "prospects"],
    ["/admin/clients/abc", "", "clients"],
    ["/admin/pipeline", "", "projects"],
    ["/admin/invoices", "", "invoices"],
    ["/admin/revenue", "", "revenue"],
    ["/admin/settings", "", "settings"],
    ["/admin/more", "", "more"],
    ["/admin/leads/abc", "", "more"],
    ["/admin/tasks", "", "more"],
    ["/admin/projects/abc/edit", "", "more"],
    ["/admin/prospect-discovery", "", "more"], // must not be caught by /admin/prospecting
  ];
  for (const [path, search, key] of cases) assert.equal(sectionForPath(path, search).key, key, `${path}?${search}`);
});

test("tabs appear only where a tab matches, and the query picks the tab", () => {
  assert.equal(activeTab("/admin/batch-discovery")?.label, "Find businesses");
  assert.equal(activeTab("/admin/lead-queue")?.label, "Next");
  assert.equal(activeTab("/admin/lead-queue", "view=followUps")?.label, "Follow-ups");
  assert.equal(activeTab("/admin/lead-queue", "view=replies"), null); // in Follow Up, but no tab of its own
  assert.equal(activeTab("/admin/prospecting", "status=MEETING,PROPOSAL_SENT,NEGOTIATION")?.label, "In talks");
  assert.equal(activeTab("/admin/prospecting"), null);
  assert.equal(activeTab("/admin"), null);
  assert.equal(activeTab("/admin/more"), null);
  assert.equal(activeTab("/admin/workspace/prospect/abc"), null);
});

test("the phone bar keeps five daily entries and the layout passes the query to the nav", () => {
  assert.deepEqual(MAIN_NAV.filter((s) => s.phone).map((s) => s.key), ["today", "find", "contact", "followUp", "more"]);
  const src = readFileSync(url("src/app/admin/layout.tsx"), "utf8");
  assert.match(src, /SIMPLE_NAV && tab\?\.hideTitleOnPhone && pathname === tab\.href && "max-lg:\[&_h1\]:sr-only"/);
  assert.match(src, /SIMPLE_NAV && tab \? sectionForPath\(pathname, search\)\.label : getPageTitle\(pathname\)/);
  assert.match(src, /<Suspense fallback=\{null\}><SearchSync onChange=\{setSearch\} \/><\/Suspense>/);
  assert.match(src, /<SectionTabs pathname=\{pathname\} search=\{search\} \/>/);
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
  assert.match(src, /SIMPLE_NAV\s*\?\s*SIMPLE_SECTIONS\s*:\s*FOCUS_MODE/);
  assert.match(src, /if \(isLogin\) return <>\{children\}<\/>;/);
});
