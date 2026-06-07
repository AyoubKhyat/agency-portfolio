"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, Target, Users, Building2, FolderKanban, CheckSquare,
  Calendar, MessageSquare, X, ArrowRight, Loader2,
  LayoutDashboard, BarChart3, Settings, Activity, Layers,
  FileSignature, Crown, BellRing,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/admin/badge";
import { cn } from "@/lib/utils";

/* ---------- types ---------- */

type SearchResultItem = {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  type: "prospect" | "lead" | "client" | "project" | "task" | "meeting" | "message";
};

type SearchResponse = {
  prospects: SearchResultItem[];
  leads: SearchResultItem[];
  clients: SearchResultItem[];
  projects: SearchResultItem[];
  tasks: SearchResultItem[];
  meetings: SearchResultItem[];
  messages: SearchResultItem[];
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

/* ---------- constants ---------- */

const ENTITY_TYPES = [
  "prospects", "leads", "clients", "projects", "tasks", "meetings", "messages",
] as const;

type EntityType = (typeof ENTITY_TYPES)[number];

const TYPE_META: Record<EntityType, { label: string; icon: typeof Target; badge: string }> = {
  prospects: { label: "Prospects", icon: Target, badge: "purple" },
  leads:     { label: "Leads",     icon: Users, badge: "blue" },
  clients:   { label: "Clients",   icon: Building2, badge: "green" },
  projects:  { label: "Projects",  icon: FolderKanban, badge: "amber" },
  tasks:     { label: "Tasks",     icon: CheckSquare, badge: "red" },
  meetings:  { label: "Meetings",  icon: Calendar, badge: "blue" },
  messages:  { label: "Messages",  icon: MessageSquare, badge: "default" },
};

type QuickAction = {
  id: string;
  label: string;
  sublabel: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "qa-cmd",       label: "Command Center",   sublabel: "Overview & quick stats",  href: "/admin/command-center", icon: Crown },
  { id: "qa-dashboard", label: "Dashboard",         sublabel: "Main dashboard",          href: "/admin",                icon: LayoutDashboard },
  { id: "qa-leads",     label: "Leads",             sublabel: "Manage incoming leads",   href: "/admin/leads",          icon: Users },
  { id: "qa-prospects", label: "Prospecting",       sublabel: "Manage prospects",        href: "/admin/prospecting",    icon: Target },
  { id: "qa-clients",   label: "Clients",           sublabel: "Client management",       href: "/admin/clients",        icon: Building2 },
  { id: "qa-projects",  label: "Projects",          sublabel: "Portfolio projects",       href: "/admin/projects",       icon: FolderKanban },
  { id: "qa-tasks",     label: "Tasks",             sublabel: "Task board",              href: "/admin/tasks",          icon: CheckSquare },
  { id: "qa-meetings",  label: "Meetings",          sublabel: "Calendar & meetings",     href: "/admin/meetings",       icon: Calendar },
  { id: "qa-chat",      label: "Chat",              sublabel: "Team chat",               href: "/admin/chat",           icon: MessageSquare },
  { id: "qa-pipeline",  label: "Pipeline",          sublabel: "Sales pipeline",          href: "/admin/pipeline",       icon: Layers },
  { id: "qa-contracts", label: "Contracts",         sublabel: "Contract management",     href: "/admin/contracts",      icon: FileSignature },
  { id: "qa-analytics", label: "Analytics",         sublabel: "Reports & stats",         href: "/admin/analytics",      icon: BarChart3 },
  { id: "qa-activity",  label: "Activity Feed",     sublabel: "Recent activity",         href: "/admin/activity",       icon: Activity },
  { id: "qa-notifs",    label: "Notifications",     sublabel: "View all notifications",  href: "/admin/notifications",  icon: BellRing },
  { id: "qa-settings",  label: "Settings",          sublabel: "System settings",         href: "/admin/settings",       icon: Settings },
];

const RECENT_SEARCHES_KEY = "os-recent-searches";
const MAX_RECENT = 5;

/* ---------- helpers ---------- */

type FlatItem = {
  key: string;
  item: SearchResultItem;
  entityType: EntityType;
};

function flattenResults(results: SearchResponse): FlatItem[] {
  const items: FlatItem[] = [];
  for (const et of ENTITY_TYPES) {
    for (const item of results[et]) {
      items.push({ key: `${et}-${item.id}`, item, entityType: et });
    }
  }
  return items;
}

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string) {
  try {
    const list = getRecentSearches().filter((s) => s !== term);
    list.unshift(term);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}

/* ---------- component ---------- */

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const flatItems = results ? flattenResults(results) : [];
  const totalResults = flatItems.length;
  const hasResults = totalResults > 0;

  // When showing quick actions (no query), we need a separate count
  const showingQuickActions = !query.trim() && !results;
  const navigableCount = showingQuickActions ? QUICK_ACTIONS.length : totalResults;

  const navigate = useCallback(
    (href: string, searchTerm?: string) => {
      if (searchTerm) saveRecentSearch(searchTerm);
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  // Load recent searches on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < navigableCount - 1 ? prev + 1 : 0));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : navigableCount - 1));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (showingQuickActions) {
          const action = QUICK_ACTIONS[selectedIndex];
          if (action) navigate(action.href);
        } else if (hasResults) {
          const item = flatItems[selectedIndex];
          if (item) navigate(item.item.href, query.trim());
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, navigableCount, hasResults, selectedIndex, flatItems, navigate, showingQuickActions, query]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setSelectedIndex(0);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data: SearchResponse = await res.json();
          setResults(data);
          setSelectedIndex(0);
        }
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  /* ---------- render helpers ---------- */

  function renderEntityGroup(entityType: EntityType) {
    if (!results) return null;
    const items = flatItems.filter((f) => f.entityType === entityType);
    if (items.length === 0) return null;

    const meta = TYPE_META[entityType];
    const Icon = meta.icon;

    return (
      <div key={entityType}>
        <div className="flex items-center gap-2 px-4 py-2">
          <Icon className="w-3.5 h-3.5 text-[#8B00FF]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            {meta.label}
          </span>
          <span className="text-[11px] text-[#94A3B8]">({items.length})</span>
        </div>
        {items.map((flat) => {
          const globalIndex = flatItems.indexOf(flat);
          const isSelected = globalIndex === selectedIndex;

          return (
            <button
              key={flat.key}
              data-selected={isSelected}
              onClick={() => navigate(flat.item.href, query.trim())}
              onMouseEnter={() => setSelectedIndex(globalIndex)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                isSelected
                  ? "bg-gradient-to-r from-[#8B00FF]/5 to-[#C026D3]/5"
                  : "hover:bg-[#F8FAFC]"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
                isSelected
                  ? "bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white"
                  : "bg-[#F1F5F9] text-[#475569]"
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#0F172A] truncate">
                  {flat.item.label}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-[#64748B] truncate">
                    {flat.item.sublabel}
                  </span>
                  <Badge
                    variant={meta.badge as "purple" | "blue" | "green" | "amber" | "red" | "default"}
                    size="sm"
                  >
                    {meta.label.slice(0, -1)}
                  </Badge>
                </div>
              </div>
              <ArrowRight className={cn(
                "w-4 h-4 shrink-0 transition-colors",
                isSelected ? "text-[#8B00FF]" : "text-[#CBD5E1]"
              )} />
            </button>
          );
        })}
      </div>
    );
  }

  function renderQuickActions() {
    return (
      <div className="py-2">
        <div className="flex items-center gap-2 px-4 py-2">
          <LayoutDashboard className="w-3.5 h-3.5 text-[#8B00FF]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            Quick Actions
          </span>
        </div>
        {QUICK_ACTIONS.map((action, idx) => {
          const isSelected = idx === selectedIndex;
          const Icon = action.icon;

          return (
            <button
              key={action.id}
              data-selected={isSelected}
              onClick={() => navigate(action.href)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                isSelected
                  ? "bg-gradient-to-r from-[#8B00FF]/5 to-[#C026D3]/5"
                  : "hover:bg-[#F8FAFC]"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
                isSelected
                  ? "bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white"
                  : "bg-[#F1F5F9] text-[#475569]"
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#0F172A] truncate">{action.label}</p>
                <p className="text-[11px] text-[#64748B] truncate">{action.sublabel}</p>
              </div>
              <ArrowRight className={cn(
                "w-4 h-4 shrink-0 transition-colors",
                isSelected ? "text-[#8B00FF]" : "text-[#CBD5E1]"
              )} />
            </button>
          );
        })}
      </div>
    );
  }

  function renderRecentSearches() {
    if (recentSearches.length === 0) return null;

    return (
      <div className="py-2 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-2 px-4 py-2">
          <Search className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            Recent Searches
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {recentSearches.map((term) => (
            <button
              key={term}
              onClick={() => setQuery(term)}
              className="inline-flex items-center px-2.5 py-1 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[12px] text-[#475569] rounded-lg transition-colors"
            >
              {term}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ---------- main render ---------- */

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[61] flex items-start justify-center pt-[12vh] px-4 sm:px-0 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="w-full max-w-[600px] bg-white rounded-2xl shadow-2xl border border-[#E5E7EB] overflow-hidden pointer-events-auto"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E5E7EB]">
                <Search className="w-5 h-5 text-[#94A3B8] shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search prospects, leads, clients, projects, tasks, meetings, messages..."
                  className="flex-1 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] bg-transparent outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="p-1 rounded-md text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9] transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 bg-[#F1F5F9] border border-[#E5E7EB] rounded text-[11px] font-medium text-[#64748B] shrink-0">
                  ESC
                </kbd>
              </div>

              {/* Results area */}
              <div ref={listRef} className="max-h-[440px] overflow-y-auto">
                {/* Loading */}
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 text-[#8B00FF] animate-spin" />
                  </div>
                )}

                {/* Search results */}
                {!loading && results && hasResults && (
                  <div className="py-2 divide-y divide-[#F1F5F9]">
                    {ENTITY_TYPES.map((et) => renderEntityGroup(et))}
                  </div>
                )}

                {/* No results */}
                {!loading && results && !hasResults && (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#F1F5F9] mb-3">
                      <Search className="w-5 h-5 text-[#94A3B8]" />
                    </div>
                    <p className="text-[14px] font-medium text-[#475569]">No results found</p>
                    <p className="text-[13px] text-[#94A3B8] mt-1">
                      Try a different search term
                    </p>
                  </div>
                )}

                {/* Empty state: recent searches + quick actions */}
                {!loading && !results && !query && (
                  <>
                    {renderRecentSearches()}
                    {renderQuickActions()}
                  </>
                )}
              </div>

              {/* Footer with keyboard hints */}
              {(hasResults || showingQuickActions) && (
                <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[#E5E7EB] bg-[#F8FAFC]">
                  <div className="flex items-center gap-1.5">
                    <kbd className="inline-flex items-center justify-center w-5 h-5 bg-white border border-[#E5E7EB] rounded text-[10px] font-medium text-[#64748B]">
                      &uarr;
                    </kbd>
                    <kbd className="inline-flex items-center justify-center w-5 h-5 bg-white border border-[#E5E7EB] rounded text-[10px] font-medium text-[#64748B]">
                      &darr;
                    </kbd>
                    <span className="text-[11px] text-[#94A3B8] ml-0.5">Navigate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="inline-flex items-center justify-center h-5 px-1.5 bg-white border border-[#E5E7EB] rounded text-[10px] font-medium text-[#64748B]">
                      Enter
                    </kbd>
                    <span className="text-[11px] text-[#94A3B8] ml-0.5">Open</span>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <kbd className="inline-flex items-center justify-center h-5 px-1.5 bg-white border border-[#E5E7EB] rounded text-[10px] font-medium text-[#64748B]">
                      Ctrl+K
                    </kbd>
                    <span className="text-[11px] text-[#94A3B8] ml-0.5">Search</span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
