/**
 * Ibda3 OS navigation: a Client Acquisition flow (Find → Qualify → Contact →
 * Follow up → Close), a quieter Business group, and More.
 *
 * Links only. Every URL is an existing page, and every query string is a
 * filter that page already reads (lead-queue `view`, prospecting `status`).
 * Nothing here reads or writes data. Pure and framework-free so it can be
 * regression-tested without a database.
 */

export type NavLink = {
  /** Path, optionally with a query string the target page already understands. */
  href: string;
  label: string;
  /** On phones the tab already names this page, so its heading is kept for screen readers only. */
  hideTitleOnPhone?: boolean;
};
export type SectionKey =
  | "today" | "find" | "qualify" | "contact" | "followUp" | "close" | "prospects"
  | "clients" | "projects" | "invoices" | "revenue"
  | "more" | "settings";
export type NavGroup = "acquisition" | "business" | "more";
export type MainSection = {
  key: SectionKey;
  label: string;
  group: NavGroup;
  /** Where the menu item goes. */
  href: string;
  tabs: readonly NavLink[];
  /** Pages (optionally with a query) that belong to this section without having a tab of their own. */
  alsoMatches?: readonly string[];
  /** Shown in the phone bottom bar (the rest are in the phone menu). */
  phone?: boolean;
};

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  acquisition: "Client acquisition",
  business: "Business",
  more: "More",
};

/** Prospect statuses of the "In talks" stage (src/lib/prospect-stages.ts), used as the Close filter. */
const IN_TALKS = "/admin/prospecting?status=MEETING,PROPOSAL_SENT,NEGOTIATION";

export const MAIN_NAV: readonly MainSection[] = [
  { key: "today", label: "Today", group: "acquisition", href: "/admin", tabs: [], phone: true },
  {
    key: "find",
    label: "Find",
    group: "acquisition",
    href: "/admin/batch-discovery",
    tabs: [
      { href: "/admin/batch-discovery", label: "Find businesses" },
      { href: "/admin/discovery", label: "AI search" },
    ],
    alsoMatches: ["/admin/workspace/discovery"],
    phone: true,
  },
  { key: "qualify", label: "Qualify", group: "acquisition", href: "/admin/qualify", tabs: [] },
  {
    key: "contact",
    label: "Contact",
    group: "acquisition",
    href: "/admin/lead-queue",
    tabs: [
      { href: "/admin/lead-queue", label: "Next" },
      { href: "/admin/outreach", label: "Outreach" },
    ],
    phone: true,
  },
  {
    key: "followUp",
    label: "Follow Up",
    group: "acquisition",
    href: "/admin/lead-queue?view=followUps",
    tabs: [
      { href: "/admin/lead-queue?view=followUps", label: "Follow-ups" },
      { href: "/admin/inbox", label: "Replies" },
    ],
    // Today's "Replies waiting" card opens the queue's replies view.
    alsoMatches: ["/admin/lead-queue?view=replies"],
    phone: true,
  },
  {
    key: "close",
    label: "Close",
    group: "acquisition",
    href: IN_TALKS,
    tabs: [
      { href: IN_TALKS, label: "In talks" },
      { href: "/admin/meetings", label: "Meetings" },
      { href: "/admin/contracts", label: "Contracts" },
    ],
  },
  {
    key: "prospects",
    label: "All Prospects",
    group: "acquisition",
    href: "/admin/prospecting",
    tabs: [],
    // A prospect's own page (with the P6B draft panel) and its workspace sit here.
    alsoMatches: ["/admin/workspace/prospect"],
  },
  { key: "clients", label: "Clients", group: "business", href: "/admin/clients", tabs: [] },
  { key: "projects", label: "Projects", group: "business", href: "/admin/pipeline", tabs: [] },
  { key: "invoices", label: "Invoices", group: "business", href: "/admin/invoices", tabs: [] },
  { key: "revenue", label: "Revenue", group: "business", href: "/admin/revenue", tabs: [] },
  { key: "more", label: "More tools", group: "more", href: "/admin/more", tabs: [], phone: true },
  { key: "settings", label: "Settings", group: "more", href: "/admin/settings", tabs: [] },
];

/** The More page: every tool that is not a menu item or a tab above. */
export const MORE_GROUPS: readonly { label: string; links: readonly NavLink[] }[] = [
  {
    label: "Everyday",
    links: [
      { href: "/admin/leads", label: "Website Enquiries" },
      { href: "/admin/tasks", label: "Tasks" },
      { href: "/admin/content", label: "Content Planner" },
      { href: "/admin/projects", label: "Website Portfolio" },
      { href: "/admin/documents", label: "Documents" },
      { href: "/admin/blog", label: "Blog" },
    ],
  },
  {
    label: "Sales",
    links: [
      { href: "/admin/sales-playbook", label: "Sales Playbook" },
    ],
  },
  {
    label: "Reports",
    links: [
      { href: "/admin/overview", label: "Full Dashboard" },
      { href: "/admin/command-center", label: "Command Center" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/activity", label: "Activity" },
      { href: "/admin/notifications", label: "Notifications" },
    ],
  },
  {
    label: "Team",
    links: [
      { href: "/admin/chat", label: "Chat" },
      { href: "/admin/team", label: "Team" },
      { href: "/admin/workload", label: "Workload" },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/admin/profile", label: "Profile" },
    ],
  },
  {
    label: "System",
    links: [
      { href: "/admin/system-status", label: "System Status" },
      { href: "/admin/webhooks", label: "Webhooks" },
    ],
  },
  {
    label: "Old tools",
    links: [
      { href: "/admin/prospect-discovery", label: "Prospect Discovery" },
      { href: "/admin/marrakech-audit", label: "Marrakech Audit" },
      { href: "/admin/city-comparison", label: "City Comparison" },
      { href: "/admin/saturation", label: "Saturation" },
      { href: "/admin/data-audit", label: "Data Audit" },
    ],
  },
];

/** Path part of a nav href. */
export function hrefPath(href: string): string {
  const i = href.indexOf("?");
  return i === -1 ? href : href.slice(0, i);
}

/** True for the page itself and anything under it, but not for a sibling such as /admin/prospect-discovery. */
function isUnder(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * How well an href matches the current page: -1 for no match, otherwise a
 * score where every query parameter the href requires (and the page has, with
 * the same value) outranks a plain path match. A query href only matches its
 * exact path, never a detail page under it.
 */
function matchScore(href: string, pathname: string, search: string): number {
  const path = hrefPath(href);
  const q = href.slice(path.length + 1);
  if (!q) return isUnder(pathname, path) ? path.length : -1;
  if (pathname !== path) return -1;
  const current = new URLSearchParams(search);
  const wanted = [...new URLSearchParams(q)];
  if (!wanted.every(([k, v]) => current.get(k) === v)) return -1;
  return 10_000 * wanted.length + path.length;
}

function sectionHrefs(s: MainSection): string[] {
  return [s.href, ...s.tabs.map((t) => t.href), ...(s.alsoMatches ?? [])];
}

/**
 * The section a page belongs to, using the query string so Contact, Follow Up
 * and Close can share a page with All Prospects. Anything unclaimed is More.
 */
export function sectionForPath(pathname: string, search = ""): MainSection {
  const more = MAIN_NAV.find((s) => s.key === "more")!;
  if (pathname === "/admin") return MAIN_NAV[0];
  let best: MainSection = more;
  let bestScore = -1;
  for (const s of MAIN_NAV) {
    if (s.key === "today") continue;
    for (const href of sectionHrefs(s)) {
      const score = matchScore(href, pathname, search);
      if (score > bestScore) { best = s; bestScore = score; }
    }
  }
  return best;
}

/** The tab a page sits under, or null when it has none. */
export function activeTab(pathname: string, search = ""): NavLink | null {
  let best: NavLink | null = null;
  let bestScore = -1;
  for (const t of sectionForPath(pathname, search).tabs) {
    const score = matchScore(t.href, pathname, search);
    if (score > bestScore) { best = t; bestScore = score; }
  }
  return best;
}
