"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive, ArchiveRestore, CalendarDays, ChevronLeft, ChevronRight, CircleDot,
  Film, GalleryHorizontal, ImageIcon, List, Pencil, Plus, Search, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { EmptyState } from "@/components/admin/empty-state";
import { Badge } from "@/components/admin/badge";
import { FormButton, Select } from "@/components/admin/form";
import {
  CONTENT_FORMATS,
  CONTENT_FORMAT_LABELS,
  CONTENT_STATUSES,
  CONTENT_STATUS_LABELS,
  calendarDays,
  followUps,
  localDayKey,
  type ContentFormat,
  type ContentPostDTO,
  type ContentStatus,
} from "@/lib/content-posts";
import { PUBLISHED_CONFIRMATION_NOTE } from "@/lib/content-calendar-import";
import { cn } from "@/lib/utils";
import { ContentPostForm } from "./ContentPostForm";

/* ---------- display maps ---------- */

const STATUS_BADGE: Record<ContentStatus, string> = {
  IDEA: "default",
  DRAFT: "amber",
  READY: "blue",
  SCHEDULED: "purple",
  PUBLISHED: "green",
};

const FORMAT_ICON: Record<ContentFormat, typeof Film> = {
  REEL: Film,
  CAROUSEL: GalleryHorizontal,
  POST: ImageIcon,
  STORY: CircleDot,
};

const WINDOW_DAYS = 30;
/** Per-viewer convenience only: the calendar's Day 1. */
const START_KEY = "content-planner-start";

function storedStart(): string {
  try {
    const v = window.localStorage.getItem(START_KEY);
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  } catch {
    /* storage blocked — fall back to today */
  }
  return localDayKey(new Date());
}

function shiftDay(day: string, by: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDayKey(new Date(y, m - 1, d + by));
}

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Not planned";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ========== page ========== */

export default function ContentPlannerPage() {
  const router = useRouter();

  const [posts, setPosts] = useState<ContentPostDTO[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const [view, setView] = useState<"calendar" | "list">("calendar");
  // Read on the client only; the calendar is rendered after the first fetch, so the
  // server-rendered markup (a skeleton) never depends on it.
  const [start, setStart] = useState(() => (typeof window === "undefined" ? "" : storedStart()));
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [formatFilter, setFormatFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContentPostDTO | null>(null);
  const [newDate, setNewDate] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "error" | "success"; msg: string } | null>(null);

  const showToast = useCallback((kind: "error" | "success", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  /* ---- data ---- */

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/content${showArchived ? "?archived=true" : ""}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          router.push("/admin/login");
          return;
        }
        if (!res.ok) {
          showToast("error", "Could not load the content plan.");
          return;
        }
        const body = await res.json();
        if (cancelled) return;
        setPosts(body.posts ?? []);
        setArchivedCount(body.archivedCount ?? 0);
      })
      .catch(() => {
        if (!cancelled) showToast("error", "Could not load the content plan.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router, showArchived, showToast]);

  function toggleArchived() {
    setLoading(true);
    setShowArchived((v) => !v);
  }

  function changeStart(day: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    setStart(day);
    try {
      window.localStorage.setItem(START_KEY, day);
    } catch {
      /* not remembered — fine */
    }
  }

  /* ---- derived ---- */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (formatFilter !== "ALL" && p.format !== formatFilter) return false;
      if (!q) return true;
      return [p.title, p.caption, p.hook, p.pillar, p.hashtags, p.nextAction].some((t) => t.toLowerCase().includes(q));
    });
  }, [posts, search, statusFilter, formatFilter]);

  const statusTabs = useMemo(
    () => [
      { value: "ALL", label: "All", count: posts.length },
      ...CONTENT_STATUSES.map((s) => ({ value: s, label: CONTENT_STATUS_LABELS[s], count: posts.filter((p) => p.status === s).length })),
    ],
    [posts],
  );

  const days = useMemo(() => (start ? calendarDays(start, WINDOW_DAYS) : []), [start]);
  const byDay = useMemo(() => {
    const map = new Map<string, ContentPostDTO[]>();
    for (const p of filtered) {
      if (!p.plannedAt) continue;
      const key = localDayKey(new Date(p.plannedAt));
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [filtered]);
  const unplanned = filtered.filter((p) => !p.plannedAt);
  const outsideWindow = filtered.filter((p) => p.plannedAt && !days.includes(localDayKey(new Date(p.plannedAt)))).length;
  const todos = useMemo(() => followUps(posts), [posts]);
  const today = localDayKey(new Date());

  /* ---- actions ---- */

  function openNew(day: string | null = null) {
    setEditing(null);
    setNewDate(day);
    setFormOpen(true);
  }

  function openEdit(post: ContentPostDTO) {
    setEditing(post);
    setNewDate(null);
    setFormOpen(true);
  }

  function handleSaved(post: ContentPostDTO, mode: "created" | "updated") {
    if (mode === "created") {
      setFormOpen(false);
      if (!showArchived) setPosts((prev) => [...prev, post]);
      showToast("success", "Post added to the plan.");
      return;
    }
    setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    // Status changes from the panels keep the form open on the fresh row.
    if (editing && editing.status !== post.status) {
      setEditing(post);
      showToast("success", post.status === "PUBLISHED" ? "Marked as published." : `Moved to ${CONTENT_STATUS_LABELS[post.status]}.`);
      return;
    }
    setFormOpen(false);
    showToast("success", "Post updated.");
  }

  async function setArchived(post: ContentPostDTO, archived: boolean) {
    setBusyId(post.id);
    try {
      const res = await fetch(`/api/admin/content/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Action failed");
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setArchivedCount((n) => Math.max(0, archived ? n + 1 : n - 1));
      showToast("success", archived ? "Post archived." : "Post restored.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  const filtersActive = search.trim() !== "" || statusFilter !== "ALL" || formatFilter !== "ALL";

  /* ---- render ---- */

  return (
    <div>
      <PageHeader
        title="Content Planner"
        subtitle="Instagram plan — prepare, schedule and track. Publishing stays manual."
        count={posts.length}
        actions={
          <button
            onClick={() => openNew()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            New post
          </button>
        }
      />

      {/* follow-up */}
      {!showArchived && !loading && todos.length > 0 && (
        <section className="mb-6 rounded-2xl border border-[var(--os-border)] bg-[var(--os-surface)] p-4 sm:p-5">
          <h2 className="text-[13px] font-semibold text-[var(--os-text)] mb-3">Next actions</h2>
          <ul className="divide-y divide-[var(--os-border)]">
            {todos.slice(0, 8).map((p) => (
              <li key={p.id}>
                <button onClick={() => openEdit(p)} className="w-full flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 py-2 text-left hover:bg-[#F8FAFC] rounded-lg px-2 -mx-2">
                  <span className="text-[12px] text-[var(--os-text-muted)] w-28 shrink-0">{formatWhen(p.plannedAt)}</span>
                  <span className="text-[13px] font-medium text-[var(--os-text)] truncate min-w-0 flex-1">{p.title}</span>
                  <span className="text-[12.5px] text-[#475569] truncate sm:max-w-[45%]">→ {p.nextAction}</span>
                  {p.overdue && <Badge variant="red" dot>Overdue</Badge>}
                </button>
              </li>
            ))}
          </ul>
          {todos.length > 8 && <p className="text-[12px] text-[var(--os-text-muted)] mt-2">+{todos.length - 8} more in the list view</p>}
        </section>
      )}

      {/* filters */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, caption, hook, hashtags…"
              className="w-full h-11 pl-9 pr-4 text-sm bg-white border border-[var(--os-border)] rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <Select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)} className="h-11 w-full sm:w-40" aria-label="Filter by format">
              <option value="ALL">All formats</option>
              {CONTENT_FORMATS.map((f) => <option key={f} value={f}>{CONTENT_FORMAT_LABELS[f]}</option>)}
            </Select>
            <div className="flex rounded-xl border border-[var(--os-border)] bg-white p-1 shrink-0" role="group" aria-label="View">
              {([["calendar", CalendarDays, "Calendar"], ["list", List, "List"]] as const).map(([v, Icon, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 rounded-lg text-[12.5px] font-medium transition-colors",
                    view === v ? "bg-purple-50 text-[#7C3AED]" : "text-[#475569] hover:bg-[#F1F5F9]",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FilterTabs items={statusTabs} active={statusFilter} onChange={setStatusFilter} />
          <button
            onClick={toggleArchived}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors",
              showArchived ? "bg-amber-50 text-amber-800 border-amber-200" : "text-[#475569] border-transparent hover:bg-[#F1F5F9]",
            )}
          >
            <Archive className="w-3.5 h-3.5" />
            {showArchived ? "Viewing archive" : `Archive (${archivedCount})`}
          </button>
        </div>
      </div>

      {/* body */}
      {loading ? (
        <div className="grid gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-16 rounded-xl" />)}
        </div>
      ) : posts.length === 0 && !showArchived ? (
        <EmptyState
          icon={<CalendarDays className="w-7 h-7" />}
          title="No posts planned yet"
          description="Add posts one by one, or load the 30-day calendar with the import script."
          action={
            <button onClick={() => openNew()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-md shadow-purple-500/20">
              <Plus className="w-4 h-4" />
              New post
            </button>
          }
        />
      ) : view === "calendar" && !showArchived ? (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <FormButton variant="secondary" size="sm" icon={<ChevronLeft className="w-4 h-4" />} onClick={() => changeStart(shiftDay(start, -WINDOW_DAYS))}>
              30 days
            </FormButton>
            <label className="inline-flex items-center gap-2 text-[12.5px] text-[#475569]">
              Day 1
              <input
                type="date"
                value={start}
                onChange={(e) => changeStart(e.target.value)}
                className="h-9 px-3 bg-white border border-[var(--os-border)] rounded-lg text-[13px] text-gray-800 focus:outline-none focus:border-purple-300"
              />
            </label>
            <FormButton variant="secondary" size="sm" onClick={() => changeStart(shiftDay(start, WINDOW_DAYS))}>
              30 days <ChevronRight className="w-4 h-4" />
            </FormButton>
            <FormButton variant="ghost" size="sm" onClick={() => changeStart(today)}>Start today</FormButton>
            {outsideWindow > 0 && (
              <span className="text-[12px] text-[var(--os-text-muted)]">{outsideWindow} matching post{outsideWindow > 1 ? "s" : ""} outside these 30 days</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
            {days.map((day, i) => {
              const items = byDay.get(day) ?? [];
              return (
                <div
                  key={day}
                  className={cn(
                    "min-h-[112px] rounded-xl border bg-white p-2 flex flex-col",
                    day === today ? "border-purple-300 ring-1 ring-purple-200" : "border-[var(--os-border)]",
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-[#7C3AED]">Day {i + 1}</span>
                    <span className="text-[11px] text-[var(--os-text-muted)]">{formatDay(day)}</span>
                  </div>
                  <div className="space-y-1 flex-1">
                    {items.map((p) => <PostChip key={p.id} post={p} onClick={() => openEdit(p)} />)}
                  </div>
                  <button
                    onClick={() => openNew(day)}
                    className="mt-1 self-start inline-flex items-center gap-1 text-[11px] text-[#94A3B8] hover:text-[#7C3AED]"
                    aria-label={`Add a post on ${formatDay(day)}`}
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
              );
            })}
          </div>

          {unplanned.length > 0 && (
            <section className="mt-5">
              <h2 className="text-[13px] font-semibold text-[var(--os-text)] mb-2">Not planned yet ({unplanned.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {unplanned.map((p) => <PostChip key={p.id} post={p} onClick={() => openEdit(p)} />)}
              </div>
            </section>
          )}
        </>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="w-7 h-7" />}
          title={showArchived ? "Nothing archived" : "No posts match these filters"}
          description={filtersActive ? "Try clearing the search or filters." : undefined}
          action={
            filtersActive ? (
              <FormButton variant="secondary" size="sm" onClick={() => { setSearch(""); setStatusFilter("ALL"); setFormatFilter("ALL"); }}>
                Clear filters
              </FormButton>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-2xl border border-[var(--os-border)] bg-white divide-y divide-[var(--os-border)]">
          {filtered.map((p) => {
            const Icon = FORMAT_ICON[p.format];
            return (
              <div key={p.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                <span className="text-[12px] text-[var(--os-text-muted)] w-28 shrink-0">{formatWhen(p.plannedAt)}</span>
                <span className="inline-flex items-center gap-1.5 text-[12px] text-[#475569] w-24 shrink-0">
                  <Icon className="w-4 h-4" /> {CONTENT_FORMAT_LABELS[p.format]}
                </span>
                <button onClick={() => openEdit(p)} className="text-[13px] font-medium text-[var(--os-text)] hover:text-[#7C3AED] text-left truncate min-w-0 flex-1">
                  {p.title}
                </button>
                {p.nextAction && p.status !== "PUBLISHED" && (
                  <span className="text-[12px] text-[#475569] truncate sm:max-w-[30%]">→ {p.nextAction}</span>
                )}
                {p.sourceKey && p.notes.includes(PUBLISHED_CONFIRMATION_NOTE) && p.status !== "PUBLISHED" && (
                  <Badge variant="amber"><AlertTriangle className="w-3 h-3" /> Confirm publication</Badge>
                )}
                <Badge variant={STATUS_BADGE[p.status]} dot>{CONTENT_STATUS_LABELS[p.status]}</Badge>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9]" aria-label="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setArchived(p, !p.archivedAt)}
                    disabled={busyId === p.id}
                    className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-50"
                    aria-label={p.archivedAt ? "Restore" : "Archive"}
                  >
                    {p.archivedAt ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <ContentPostForm
          key={editing ? `${editing.id}:${editing.status}` : `new:${newDate ?? ""}`}
          post={editing}
          defaultDate={newDate}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}

      {toast && (
        <div
          role="status"
          className={cn(
            "fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium",
            toast.kind === "error" ? "bg-red-600 text-white" : "bg-[#0F172A] text-white",
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function PostChip({ post, onClick }: { post: ContentPostDTO; onClick: () => void }) {
  const Icon = FORMAT_ICON[post.format];
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#F8FAFC] hover:bg-purple-50 text-left"
      title={`${CONTENT_FORMAT_LABELS[post.format]} · ${CONTENT_STATUS_LABELS[post.status]}`}
    >
      <Icon className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
      <span className="text-[12px] text-[#0F172A] truncate flex-1">{post.title}</span>
      <Badge variant={STATUS_BADGE[post.status]} className="px-1.5 text-[10px]">{CONTENT_STATUS_LABELS[post.status]}</Badge>
    </button>
  );
}
