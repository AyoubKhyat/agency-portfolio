"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  CheckCircle2, Circle, Clock, AlertCircle, Plus, X, Trash2, ChevronDown,
  Loader2, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus   = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";

export type Task = {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  parentType: string | null;
  parentId: string | null;
  parentLabel: string | null;
  ownerId: string | null;
  ownerName: string | null;
  owner: { id: string; fullName: string; avatarInitials: string } | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeamMember = { id: string; fullName: string; avatarInitials: string };

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent",
};

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  LOW:    "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]",
  MEDIUM: "bg-blue-50 text-blue-700 border-blue-100",
  HIGH:   "bg-amber-50 text-amber-700 border-amber-100",
  URGENT: "bg-red-50 text-red-700 border-red-100",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Todo", IN_PROGRESS: "In Progress", BLOCKED: "Blocked", DONE: "Done",
};

function dueRelative(due: string | null): { label: string; color: string; overdue: boolean } {
  if (!due) return { label: "No due date", color: "text-[#9CA3AF]", overdue: false };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(due);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - now.getTime()) / 86_400_000);
  if (diff < 0) return { label: `${-diff}d overdue`, color: "text-red-600", overdue: true };
  if (diff === 0) return { label: "Today", color: "text-amber-600", overdue: false };
  if (diff === 1) return { label: "Tomorrow", color: "text-blue-600", overdue: false };
  if (diff < 7) return { label: `In ${diff}d`, color: "text-[#6B7280]", overdue: false };
  return { label: new Date(due).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }), color: "text-[#6B7280]", overdue: false };
}

type TaskListProps = {
  parentType?: "PROSPECT" | "CLIENT" | "PROJECT" | "PROPOSAL";
  parentId?: string;
  parentLabel?: string;
  scope?: "mine" | "overdue" | "today" | "upcoming";
  ownerId?: string;
  status?: TaskStatus;
  title?: string;
  emptyHint?: string;
  showCreator?: boolean;
  team?: TeamMember[];
  defaultOwnerId?: string;
  className?: string;
  compact?: boolean;
};

export function TaskList({
  parentType, parentId, parentLabel, scope, ownerId, status,
  title = "Tasks", emptyHint = "No tasks yet.", showCreator = true,
  team: teamProp, defaultOwnerId, className, compact,
}: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<TeamMember[]>(teamProp ?? []);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("MEDIUM");
  const [newDue, setNewDue] = useState("");
  const [newOwnerId, setNewOwnerId] = useState(defaultOwnerId ?? "");

  function buildQuery() {
    const sp = new URLSearchParams();
    if (parentType) sp.set("parentType", parentType);
    if (parentId) sp.set("parentId", parentId);
    if (scope) sp.set("scope", scope);
    if (ownerId) sp.set("ownerId", ownerId);
    if (status) sp.set("status", status);
    return sp.toString();
  }

  async function load() {
    const qs = buildQuery();
    const res = await fetch(`/api/admin/tasks${qs ? `?${qs}` : ""}`);
    if (res.ok) {
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    if (!teamProp) {
      fetch("/api/admin/users")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setTeam(Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentType, parentId, scope, ownerId, status]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          priority: newPriority,
          dueDate: newDue || null,
          parentType: parentType ?? null,
          parentId: parentId ?? null,
          parentLabel: parentLabel ?? null,
          ownerId: newOwnerId || null,
        }),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks((prev) => [task, ...prev]);
        setNewTitle("");
        setNewDue("");
        setShowForm(false);
      }
    } finally {
      setCreating(false);
    }
  }

  async function toggleDone(task: Task) {
    const nextStatus: TaskStatus = task.status === "DONE" ? "TODO" : "DONE";
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    const res = await fetch(`/api/admin/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    }
  }

  async function changeStatus(task: Task, next: TaskStatus) {
    const res = await fetch(`/api/admin/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    }
  }

  async function deleteTask(task: Task) {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    await fetch(`/api/admin/tasks/${task.id}`, { method: "DELETE" });
  }

  return (
    <div className={cn("bg-white border border-[#E5E7EB] rounded-xl", className)}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold text-[#111827]">{title}</h3>
          <span className="text-[11px] text-[#9CA3AF] font-medium">({tasks.length})</span>
        </div>
        {showCreator && (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#8B00FF] hover:text-[#7A00E0]"
          >
            <Plus className="w-3.5 h-3.5" /> {showForm ? "Cancel" : "Add"}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && showCreator && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleCreate}
            className="px-5 py-4 border-b border-[#E5E7EB] bg-[#FAFAFE] space-y-3"
          >
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What needs to happen?"
              className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#8B00FF] focus:ring-2 focus:ring-[#8B00FF]/15"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                className="h-9 px-2 bg-white border border-[#D1D5DB] rounded-lg text-[12px] text-[#111827]"
              >
                <option value="LOW">Low priority</option>
                <option value="MEDIUM">Medium priority</option>
                <option value="HIGH">High priority</option>
                <option value="URGENT">Urgent</option>
              </select>
              <input
                type="date"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                className="h-9 px-2 bg-white border border-[#D1D5DB] rounded-lg text-[12px] text-[#111827]"
              />
              <select
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
                className="h-9 px-2 bg-white border border-[#D1D5DB] rounded-lg text-[12px] text-[#111827]"
              >
                <option value="">Unassigned</option>
                {team.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating || !newTitle.trim()}
                className="h-9 px-4 bg-[#8B00FF] hover:bg-[#7A00E0] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {creating && <Loader2 className="w-3 h-3 animate-spin" />}
                {creating ? "Adding..." : "Add task"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setNewTitle(""); }}
                className="h-9 px-3 text-[12px] text-[#6B7280] hover:text-[#111827]"
              >
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div>
        {loading ? (
          <div className="px-5 py-8 text-center text-[12px] text-[#9CA3AF]">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12px] text-[#9CA3AF]">{emptyHint}</div>
        ) : (
          <ul className="divide-y divide-[#F3F4F6]">
            {tasks.map((t) => {
              const due = dueRelative(t.dueDate);
              const done = t.status === "DONE";
              return (
                <li key={t.id} className="group px-5 py-3 hover:bg-[#FAFAFE] transition-colors">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleDone(t)}
                      className="mt-0.5 shrink-0"
                      aria-label={done ? "Mark as not done" : "Mark as done"}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : t.status === "BLOCKED" ? (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      ) : t.status === "IN_PROGRESS" ? (
                        <Clock className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-[#9CA3AF] hover:text-[#8B00FF]" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        <p className={cn(
                          "text-[13px] font-medium leading-snug",
                          done ? "text-[#9CA3AF] line-through" : "text-[#111827]",
                        )}>
                          {t.title}
                        </p>
                        {t.priority !== "MEDIUM" && (
                          <span className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                            PRIORITY_STYLE[t.priority],
                          )}>
                            {PRIORITY_LABEL[t.priority]}
                          </span>
                        )}
                      </div>
                      {t.description && !compact && (
                        <p className="text-[12px] text-[#6B7280] mt-0.5">{t.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[11px] flex-wrap">
                        <span className={cn("inline-flex items-center gap-1", due.color)}>
                          <CalendarDays className="w-3 h-3" /> {due.label}
                        </span>
                        {t.owner && (
                          <span className="inline-flex items-center gap-1 text-[#6B7280]">
                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white text-[8px] font-bold">
                              {t.owner.avatarInitials}
                            </span>
                            {t.owner.fullName}
                          </span>
                        )}
                        {!parentId && t.parentLabel && (
                          <Link
                            href={parentHref(t.parentType, t.parentId)}
                            className="inline-flex items-center gap-1 text-[#8B00FF] hover:underline"
                          >
                            {t.parentLabel}
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                      <div className="relative">
                        <select
                          value={t.status}
                          onChange={(e) => changeStatus(t, e.target.value as TaskStatus)}
                          className="h-7 pl-2 pr-6 bg-white border border-[#E5E7EB] rounded-md text-[11px] text-[#374151] appearance-none cursor-pointer"
                        >
                          {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as TaskStatus[]).map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9CA3AF] pointer-events-none" />
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteTask(t)}
                        className="p-1 rounded-md text-[#9CA3AF] hover:text-red-500 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function parentHref(parentType: string | null, parentId: string | null): string {
  if (!parentType || !parentId) return "#";
  switch (parentType) {
    case "CLIENT":   return `/admin/clients/${parentId}`;
    case "PROJECT":  return `/admin/projects/${parentId}/edit`;
    case "PROPOSAL": return `/admin/proposals/${parentId}`;
    case "PROSPECT": return `/admin/prospecting/${parentId}`;
    default: return "#";
  }
}
