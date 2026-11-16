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
  assert.deepEqual(byGroup("acquisition"), ["Today", "Find", "Prospects", "Deals"]);
  assert.deepEqual(byGroup("business"), ["Clients", "Projects", "Invoices", "Revenue"]);
  assert.deepEqual(byGroup("more"), ["More tools", "Settings"]);
  assert.equal(MAIN_NAV.length, 10);
});

test("P6C finder leads Find, P6A is Find's website check, P6B stays on the prospect page", () => {
  const find = MAIN_NAV.find((s) => s.key === "find")!;
  assert.equal(find.href, "/admin/batch-discovery");
  assert.equal(find.tabs[0].href, "/admin/batch-discovery");
  assert.deepEqual(find.tabs.map((t) => t.label), ["Find businesses", "Check a website"]);
  assert.ok(!find.tabs.some((t) => t.href === "/admin/discovery"), "template-based discovery isn't presented as an AI tab");
  assert.equal(find.tabs[1].href, "/admin/qualify");
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
  // ...and a filter picked on the page writes ?view= back, so the menu stays on the right entry.
  assert.match(queue, /router\.replace\(v === "all" \? "\/admin\/lead-queue" : `\/admin\/lead-queue\?view=\$\{v\}`, \{ scroll: false \}\)/);
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
    ["/admin/qualify", "", "find"],
    // Every old lead-queue link lands in Prospects (the optional focus mode).
    ["/admin/lead-queue", "", "prospects"],
    ["/admin/lead-queue", "view=ready", "prospects"],
    ["/admin/lead-queue", "view=followUps", "prospects"],
    ["/admin/lead-queue", "view=replies", "prospects"],
    ["/admin/lead-queue", "view=verify", "prospects"],
    ["/admin/lead-queue", "view=enquiries", "prospects"],
    ["/admin/outreach", "", "more"],
    ["/admin/inbox", "", "more"],
    ["/admin/prospecting", "group=CONTACTED", "prospects"],
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
  assert.equal(activeTab("/admin/qualify")?.label, "Check a website");
  for (const v of ["", "view=followUps", "view=replies", "view=verify"]) assert.equal(activeTab("/admin/lead-queue", v)?.label, "Work through leads", v);
  assert.equal(activeTab("/admin/prospecting", "status=MEETING,PROPOSAL_SENT,NEGOTIATION")?.label, "In talks");
  assert.equal(activeTab("/admin/prospecting")?.label, "Prospect list");
  assert.equal(activeTab("/admin/prospecting/abc")?.label, "Prospect list");
  assert.equal(activeTab("/admin"), null);
  assert.equal(activeTab("/admin/more"), null);
  assert.equal(activeTab("/admin/workspace/prospect/abc"), null);
  assert.equal(activeTab("/admin/inbox"), null);
});

test("the phone bar keeps five daily entries and the layout passes the query to the nav", () => {
  assert.deepEqual(MAIN_NAV.filter((s) => s.phone).map((s) => s.key), ["today", "find", "prospects", "more"]);
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

test("beginner menu: one entry per job, the prospect list first, focus mode and the Daily Lead Agent one click away", () => {
  const acquisition = MAIN_NAV.filter((s) => s.group === "acquisition");
  // No two menu entries open the same page (the old Contact / Follow Up / All Prospects overlap).
  const paths = acquisition.filter((s) => s.key !== "close").map((s) => hrefPath(s.href));
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(!MAIN_NAV.some((s) => hrefPath(s.href) === "/admin/lead-queue"), "the focus mode is a tab, not a menu entry");
  const prospects = MAIN_NAV.find((s) => s.key === "prospects")!;
  assert.equal(prospects.href, "/admin/prospecting");
  assert.deepEqual(prospects.tabs.map((t) => [t.label, t.href]), [["Prospect list", "/admin/prospecting"], ["Work through leads", "/admin/lead-queue"]]);
  // The Daily Lead Agent stays on Today.
  assert.equal(MAIN_NAV[0].href, "/admin");
  assert.match(readFileSync(url("src/app/admin/page.tsx"), "utf8"), /<TodaysLeads \/>/);
  // The list reaches the focus mode through the Prospects tabs (shown on every Prospects page, phone and desktop),
  // not a second button with the same name; the focus mode links back.
  assert.equal(activeTab("/admin/prospecting")?.label, "Prospect list");
  assert.doesNotMatch(readFileSync(url("src/app/admin/prospecting/page.tsx"), "utf8"), /href="\/admin\/lead-queue"/);
  assert.match(readFileSync(url("src/app/admin/layout.tsx"), "utf8"), /SIMPLE_NAV && <SectionTabs pathname=\{pathname\} search=\{search\} \/>/);
  assert.match(readFileSync(url("src/app/admin/layout.tsx"), "utf8"), /const SIMPLE_NAV = true;/);
  const queue = readFileSync(url("src/app/admin/lead-queue/page.tsx"), "utf8");
  assert.match(queue, />Work through leads<\/h1>/);
  assert.doesNotMatch(queue, />Command Center<\/h1>/, "not the same name as the Command Center report");
  // Every icon key matches a menu entry.
  const layout = readFileSync(url("src/app/admin/layout.tsx"), "utf8");
  for (const s of MAIN_NAV) assert.match(layout, new RegExp(`\\b${s.key}: `), s.key);
});
