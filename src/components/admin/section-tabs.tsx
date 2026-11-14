"use client";

import Link from "next/link";
import { activeTab, sectionForPath } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

/** Tabs for the current section. Renders nothing on pages that have no tab. */
export function SectionTabs({ pathname, search = "" }: { pathname: string; search?: string }) {
  const current = activeTab(pathname, search);
  if (!current) return null;
  const section = sectionForPath(pathname, search);

  return (
    <nav aria-label={section.label} className="flex gap-1 mb-5 overflow-x-auto scrollbar-none border-b border-[var(--os-border)]">
      {section.tabs.map((tab) => {
        const active = tab.href === current.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-3 py-2.5 -mb-px text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors",
              active
                ? "border-[var(--os-purple)] text-[var(--os-purple)]"
                : "border-transparent text-[var(--os-text-muted)] hover:text-[var(--os-text)]"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
