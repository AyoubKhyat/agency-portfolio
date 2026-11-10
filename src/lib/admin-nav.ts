/**
 * Ibda3 OS navigation: five sections, plus tabs inside them.
 *
 * Links only. Every URL is an existing page; nothing here reads or writes data.
 * Pure and framework-free so it can be regression-tested without a database.
 */

export type NavLink = {
  href: string;
  label: string;
  /** On phones the tab already names this page, so its heading is kept for screen readers only. */
  hideTitleOnPhone?: boolean;
};
export type SectionKey = "today" | "leads" | "clients" | "money" | "more";
export type MainSection = {
  key: SectionKey;
  label: string;
  /** Where the menu item goes. */
  href: string;
  tabs: readonly NavLink[];
  /** Pages that belong to this section without having a tab of their own. */
  alsoMatches?: readonly string[];
};

// To RESTORE the previous Leads tabs: set LEADS_QUEUE = false. The queue page stays at its URL.
export const LEADS_QUEUE: boolean = true;

export const MAIN_NAV: readonly MainSection[] = [
  { key: "today", label: "Today", href: "/admin", tabs: [] },
  {
    key: "leads",
    label: "Leads",
    href: LEADS_QUEUE ? "/admin/lead-queue" : "/admin/prospecting",
    tabs: LEADS_QUEUE
      ? [
          { href: "/admin/lead-queue", label: "Next" },
          { href: "/admin/prospecting", label: "All prospects", hideTitleOnPhone: true },
          { href: "/admin/inbox", label: "Replies" },
          { href: "/admin/leads", label: "Enquiries" },
        ]
      : [
          { href: "/admin/prospecting", label: "Prospects", hideTitleOnPhone: true },
          { href: "/admin/inbox", label: "Replies" },
          { href: "/admin/leads", label: "Enquiries" },
          { href: "/admin/discovery", label: "Find new" },
        ],
    // Find new is a button on the Next page, so it sits outside the tabs.
    alsoMatches: ["/admin/workspace", "/admin/discovery"],
  },
  {
    key: "clients",
    label: "Clients",
    href: "/admin/clients",
    tabs: [
      { href: "/admin/clients", label: "Clients" },
      { href: "/admin/pipeline", label: "Projects" },
      { href: "/admin/tasks", label: "Tasks" },
      { href: "/admin/meetings", label: "Meetings" },
    ],
  },
  {
    key: "money",
    label: "Money",
    href: "/admin/invoices",
    tabs: [
      { href: "/admin/invoices", label: "Invoices" },
      { href: "/admin/revenue", label: "Revenue" },
      { href: "/admin/contracts", label: "Contracts" },
    ],
  },
  { key: "more", label: "More", href: "/admin/more", tabs: [] },
];

/** The More page: every tool that is not one of the tabs above. */
export const MORE_GROUPS: readonly { label: string; links: readonly NavLink[] }[] = [
  {
    label: "Everyday",
    links: [
      { href: "/admin/content", label: "Content Planner" },
      { href: "/admin/projects", label: "Website Portfolio" },
      { href: "/admin/documents", label: "Documents" },
      { href: "/admin/blog", label: "Blog" },
    ],
  },
  {
    label: "Sales",
    links: [
      ...(LEADS_QUEUE ? [{ href: "/admin/discovery", label: "Find new" }] : []),
      { href: "/admin/qualify", label: "Check a website" },
      { href: "/admin/outreach", label: "Outreach" },
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
      { href: "/admin/settings", label: "Settings" },
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

/** True for the page itself and anything under it, but not for a sibling such as /admin/prospect-discovery. */
function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The section a page belongs to. Anything not claimed by another section belongs to More. */
export function sectionForPath(pathname: string): MainSection {
  const more = MAIN_NAV[MAIN_NAV.length - 1];
  if (pathname === "/admin") return MAIN_NAV[0];
  return (
    MAIN_NAV.find((s) => s.key !== "today" && (s.tabs.some((t) => isUnder(pathname, t.href)) || s.alsoMatches?.some((h) => isUnder(pathname, h)))) ?? more
  );
}

/** The tab a page sits under, or null when it has none. */
export function activeTab(pathname: string): NavLink | null {
  return sectionForPath(pathname).tabs.find((t) => isUnder(pathname, t.href)) ?? null;
}
