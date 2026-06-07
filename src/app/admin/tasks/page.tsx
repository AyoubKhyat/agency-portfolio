"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckSquare, AlertCircle, Sun, Inbox, Users, List, GanttChart } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { TaskList, type Task, type TeamMember } from "@/components/admin/task-list";
import { TaskTimeline } from "@/components/admin/task-timeline";

type Scope = "mine" | "overdue" | "today" | "upcoming" | "all";
type ViewMode = "list" | "timeline";

const SCOPE_DEFS: { value: Scope; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "mine",     label: "My open tasks", icon: CheckSquare },
  { value: "today",    label: "Due today",     icon: Sun },
  { value: "overdue",  label: "Overdue",       icon: AlertCircle },
  { value: "upcoming", label: "Upcoming",      icon: Inbox },
  { value: "all",      label: "All",           icon: Users },
];

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-0.5">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150 ${
          view === "list"
            ? "bg-white text-[#111827] shadow-sm border border-[#E5E7EB]"
            : "text-[#6B7280] hover:text-[#111827]"
        }`}
        title="List view"
      >
        <List className="w-3.5 h-3.5" />
        List
      </button>
      <button
        type="button"
        onClick={() => onChange("timeline")}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150 ${
          view === "timeline"
            ? "bg-white text-[#111827] shadow-sm border border-[#E5E7EB]"
            : "text-[#6B7280] hover:text-[#111827]"
        }`}
        title="Timeline view"
      >
        <GanttChart className="w-3.5 h-3.5" />
        Timeline
      </button>
    </div>
  );
}

function ScopeIndicator({ scope }: { scope: Scope }) {
  const def = SCOPE_DEFS.find((d) => d.value === scope);
  if (!def) return null;
  const Icon = def.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#6B7280]">
      <Icon className="w-3.5 h-3.5" /> {def.label}
    </span>
  );
}

function TasksPageInner() {
  const params = useSearchParams();
  const initialScope = (params.get("scope") as Scope) || "mine";
  const [scope, setScope] = useState<Scope>(initialScope);
  const [view, setView] = useState<ViewMode>("list");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [counts, setCounts] = useState<{ mine: number; overdue: number; today: number; upcoming: number; all: number } | null>(null);

  // Tasks state for timeline view
  const [timelineTasks, setTimelineTasks] = useState<Task[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (Array.isArray(d)) setTeam(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/tasks?scope=mine&limit=500").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/admin/tasks?scope=overdue&limit=500").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/admin/tasks?scope=today&limit=500").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/admin/tasks?scope=upcoming&limit=500").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/admin/tasks?limit=500").then((r) => (r.ok ? r.json() : [])),
    ]).then(([mine, overdue, today, upcoming, all]) => {
      setCounts({
        mine: mine.length, overdue: overdue.length, today: today.length,
        upcoming: upcoming.length, all: all.length,
      });
    }).catch(() => {});
  }, [scope]);

  // Fetch tasks for the timeline when in timeline mode
  const loadTimelineTasks = useCallback(() => {
    setTimelineLoading(true);
    const sp = new URLSearchParams();
    if (scope !== "all") sp.set("scope", scope);
    sp.set("limit", "500");
    fetch(`/api/admin/tasks?${sp.toString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setTimelineTasks(Array.isArray(data) ? data : []);
      })
      .catch(() => setTimelineTasks([]))
      .finally(() => setTimelineLoading(false));
  }, [scope]);

  useEffect(() => {
    if (view === "timeline") {
      loadTimelineTasks();
    }
  }, [view, scope, loadTimelineTasks]);

  const items = useMemo(() => SCOPE_DEFS.map((d) => ({
    value: d.value,
    label: d.label,
    count: counts ? counts[d.value] : undefined,
  })), [counts]);

  const listContent = scope === "all"
    ? <TaskList key="all" team={team} title="All tasks" emptyHint="No tasks yet — create one from any record or here." />
    : <TaskList key={scope} scope={scope} team={team} title={SCOPE_DEFS.find((d) => d.value === scope)!.label} />;

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Work assigned across prospects, clients, projects and proposals"
        actions={
          <div className="flex items-center gap-3">
            <ScopeIndicator scope={scope} />
            <ViewToggle view={view} onChange={setView} />
          </div>
        }
      />
      <div className="mb-4">
        <FilterTabs items={items} active={scope} onChange={(v) => setScope(v as Scope)} />
      </div>
      {view === "list" ? listContent : (
        <TaskTimeline tasks={timelineTasks} team={team} loading={timelineLoading} />
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-purple-200 border-t-[#8B00FF] rounded-full animate-spin" /></div>}>
      <TasksPageInner />
    </Suspense>
  );
}
