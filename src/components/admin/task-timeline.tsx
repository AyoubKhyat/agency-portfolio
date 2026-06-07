"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus, TeamMember } from "./task-list";

/* ─── constants ─── */

const DAY_MS = 86_400_000;
const COL_W = 40; // px per day
const ROW_H = 36; // px per task bar row
const HEADER_H = 56; // date header height
const LANE_PAD = 8; // top/bottom padding inside a lane
const LANE_LABEL_W = 180; // left label column width

const STATUS_COLOR: Record<TaskStatus, { bg: string; border: string; text: string }> = {
  TODO:        { bg: "bg-gray-200",     border: "border-gray-300",    text: "text-gray-700" },
  IN_PROGRESS: { bg: "bg-blue-200",     border: "border-blue-400",    text: "text-blue-800" },
  BLOCKED:     { bg: "bg-purple-200",   border: "border-purple-400",  text: "text-purple-800" },
  DONE:        { bg: "bg-emerald-200",  border: "border-emerald-400", text: "text-emerald-800" },
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Todo", IN_PROGRESS: "In Progress", BLOCKED: "Blocked", DONE: "Done",
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent",
};

/* ─── helpers ─── */

function dayStart(d: Date | string): Date {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function fmtShortDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function fmtFullDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/* ─── types ─── */

type Lane = {
  label: string;
  initials: string;
  tasks: Task[];
};

type TaskTimelineProps = {
  tasks: Task[];
  team: TeamMember[];
  loading?: boolean;
};

/* ─── component ─── */

export function TaskTimeline({ tasks, team, loading }: TaskTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<{ task: Task; x: number; y: number } | null>(null);

  // ── compute date range ──
  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    if (tasks.length === 0) {
      const today = dayStart(new Date());
      return { rangeStart: addDays(today, -7), rangeEnd: addDays(today, 21), totalDays: 28 };
    }

    let minDate = Infinity;
    let maxDate = -Infinity;

    for (const t of tasks) {
      const created = dayStart(t.createdAt).getTime();
      const due = t.dueDate ? dayStart(t.dueDate).getTime() : created;
      if (created < minDate) minDate = created;
      if (due > maxDate) maxDate = due;
      if (created > maxDate) maxDate = created;
    }

    // Add padding: 3 days before, 7 days after
    const start = addDays(new Date(minDate), -3);
    const end = addDays(new Date(maxDate), 7);
    const total = diffDays(start, end) + 1;
    return { rangeStart: start, rangeEnd: end, totalDays: Math.max(total, 14) };
  }, [tasks]);

  // ── group tasks into lanes by owner ──
  const lanes = useMemo<Lane[]>(() => {
    const map = new Map<string, Task[]>();
    const order: string[] = [];

    for (const t of tasks) {
      const key = t.ownerId || "__unassigned__";
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(t);
    }

    return order.map((key) => {
      const laneTasks = map.get(key)!;
      if (key === "__unassigned__") {
        return { label: "Unassigned", initials: "?", tasks: laneTasks };
      }
      const first = laneTasks[0];
      return {
        label: first.owner?.fullName || first.ownerName || "Unknown",
        initials: first.owner?.avatarInitials || (first.ownerName ? first.ownerName.slice(0, 2).toUpperCase() : "??"),
        tasks: laneTasks,
      };
    });
  }, [tasks]);

  // ── scroll to today on mount ──
  const today = dayStart(new Date());
  const todayOffset = diffDays(rangeStart, today);

  useEffect(() => {
    if (scrollRef.current && todayOffset > 0) {
      const scrollTo = todayOffset * COL_W - scrollRef.current.clientWidth / 3;
      scrollRef.current.scrollLeft = Math.max(0, scrollTo);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length]);

  // ── generate day columns ──
  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      result.push(addDays(rangeStart, i));
    }
    return result;
  }, [rangeStart, totalDays]);

  // ── close popup on outside click ──
  useEffect(() => {
    if (!popup) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-task-popup]") && !target.closest("[data-task-bar]")) {
        setPopup(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popup]);

  const gridWidth = totalDays * COL_W;

  if (loading) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-xl px-5 py-12 text-center text-[12px] text-[#9CA3AF]">
        Loading timeline...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-xl px-5 py-12 text-center text-[12px] text-[#9CA3AF]">
        No tasks to display on the timeline.
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden relative">
      {/* ── legend ── */}
      <div className="flex items-center gap-4 px-5 py-2.5 border-b border-[#E5E7EB] bg-[#FAFAFE]">
        <span className="text-[11px] font-medium text-[#6B7280]">Status:</span>
        {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as TaskStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[11px]">
            <span className={cn("w-3 h-3 rounded-sm border", STATUS_COLOR[s].bg, STATUS_COLOR[s].border)} />
            <span className="text-[#374151]">{STATUS_LABEL[s]}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-[11px] ml-auto">
          <span className="w-0.5 h-3 bg-red-500 rounded-full" />
          <span className="text-[#374151]">Today</span>
        </span>
      </div>

      <div className="flex">
        {/* ── fixed left column (lane labels) ── */}
        <div className="shrink-0 border-r border-[#E5E7EB] bg-[#FAFAFE] z-10" style={{ width: LANE_LABEL_W }}>
          {/* header spacer */}
          <div className="border-b border-[#E5E7EB]" style={{ height: HEADER_H }} />
          {/* lane labels */}
          {lanes.map((lane, li) => {
            const laneH = lane.tasks.length * ROW_H + LANE_PAD * 2;
            return (
              <div
                key={li}
                className={cn("flex items-start gap-2 px-3 pt-2 border-b border-[#F3F4F6]")}
                style={{ height: laneH }}
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white text-[9px] font-bold shrink-0 mt-0.5">
                  {lane.initials}
                </span>
                <span className="text-[12px] font-medium text-[#111827] truncate leading-7">
                  {lane.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── scrollable grid area ── */}
        <div ref={scrollRef} className="overflow-x-auto flex-1 relative">
          <div style={{ width: gridWidth, minHeight: "100%" }} className="relative">
            {/* ── date header ── */}
            <div className="sticky top-0 z-20 bg-white border-b border-[#E5E7EB]" style={{ height: HEADER_H }}>
              {/* month row */}
              <div className="flex" style={{ height: 24 }}>
                {(() => {
                  const months: { label: string; startIdx: number; span: number }[] = [];
                  let cur = "";
                  for (let i = 0; i < days.length; i++) {
                    const mLabel = days[i].toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
                    if (mLabel !== cur) {
                      months.push({ label: mLabel, startIdx: i, span: 1 });
                      cur = mLabel;
                    } else {
                      months[months.length - 1].span++;
                    }
                  }
                  return months.map((m, i) => (
                    <div
                      key={i}
                      className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider flex items-center px-1 border-r border-[#F3F4F6]"
                      style={{ width: m.span * COL_W, left: m.startIdx * COL_W }}
                    >
                      {m.label}
                    </div>
                  ));
                })()}
              </div>
              {/* day row */}
              <div className="flex" style={{ height: HEADER_H - 24 }}>
                {days.map((d, i) => {
                  const isToday = d.getTime() === today.getTime();
                  const wknd = isWeekend(d);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex flex-col items-center justify-center border-r border-[#F3F4F6] text-[10px]",
                        isToday && "bg-red-50 font-bold text-red-600",
                        wknd && !isToday && "text-[#C4C9D2]",
                        !wknd && !isToday && "text-[#6B7280]",
                      )}
                      style={{ width: COL_W }}
                    >
                      <span>{d.toLocaleDateString("fr-FR", { weekday: "narrow" })}</span>
                      <span className="font-semibold">{d.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── lane rows + bars ── */}
            {lanes.map((lane, li) => {
              const laneH = lane.tasks.length * ROW_H + LANE_PAD * 2;
              return (
                <div
                  key={li}
                  className="relative border-b border-[#F3F4F6]"
                  style={{ height: laneH }}
                >
                  {/* weekend shading columns */}
                  {days.map((d, i) => {
                    if (!isWeekend(d)) return null;
                    return (
                      <div
                        key={`wknd-${i}`}
                        className="absolute top-0 bottom-0 bg-gray-50/60"
                        style={{ left: i * COL_W, width: COL_W }}
                      />
                    );
                  })}

                  {/* vertical grid lines (every day) */}
                  {days.map((_, i) => (
                    <div
                      key={`vline-${i}`}
                      className="absolute top-0 bottom-0 border-r border-[#F3F4F6]"
                      style={{ left: (i + 1) * COL_W }}
                    />
                  ))}

                  {/* task bars */}
                  {lane.tasks.map((task, ti) => {
                    const taskStart = dayStart(task.createdAt);
                    const taskEnd = task.dueDate ? dayStart(task.dueDate) : taskStart;
                    const startOff = diffDays(rangeStart, taskStart);
                    const duration = Math.max(diffDays(taskStart, taskEnd), 0) + 1; // at least 1 day
                    const left = startOff * COL_W + 2;
                    const width = Math.max(duration * COL_W - 4, 20); // min 20px
                    const top = LANE_PAD + ti * ROW_H + 4;
                    const colors = STATUS_COLOR[task.status as TaskStatus] || STATUS_COLOR.TODO;

                    return (
                      <div
                        key={task.id}
                        data-task-bar
                        className={cn(
                          "absolute h-[28px] rounded-md border cursor-pointer flex items-center px-2 overflow-hidden transition-shadow hover:shadow-md hover:z-10",
                          colors.bg, colors.border,
                        )}
                        style={{ left, width, top }}
                        title={`${task.title} (${STATUS_LABEL[task.status as TaskStatus]})`}
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setPopup({
                            task,
                            x: rect.left + rect.width / 2,
                            y: rect.bottom + 4,
                          });
                        }}
                      >
                        <span className={cn("text-[10px] font-medium truncate", colors.text)}>
                          {task.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* ── today marker ── */}
            {todayOffset >= 0 && todayOffset < totalDays && (
              <div
                className="absolute z-30 pointer-events-none"
                style={{
                  left: todayOffset * COL_W + COL_W / 2 - 1,
                  top: 0,
                  bottom: 0,
                  width: 2,
                }}
              >
                <div className="w-full h-full bg-red-500 opacity-60" />
                <div className="absolute -top-0 -left-[5px] w-3 h-3 rounded-full bg-red-500" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── detail popup ── */}
      {popup && (
        <div
          data-task-popup
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-[#E5E7EB] p-4 min-w-[280px] max-w-[340px]"
          style={{
            left: Math.min(popup.x - 140, window.innerWidth - 360),
            top: Math.min(popup.y, window.innerHeight - 260),
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <h4 className="text-[14px] font-semibold text-[#111827] leading-snug">
              {popup.task.title}
            </h4>
            <button
              onClick={() => setPopup(null)}
              className="shrink-0 p-0.5 rounded-md hover:bg-[#F3F4F6] text-[#9CA3AF] hover:text-[#374151]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {popup.task.description && (
            <p className="text-[12px] text-[#6B7280] mb-3 leading-relaxed">
              {popup.task.description}
            </p>
          )}

          <div className="space-y-2 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-[#9CA3AF]">Status</span>
              <span className={cn(
                "px-2 py-0.5 rounded-md border text-[11px] font-medium",
                STATUS_COLOR[popup.task.status as TaskStatus]?.bg,
                STATUS_COLOR[popup.task.status as TaskStatus]?.border,
                STATUS_COLOR[popup.task.status as TaskStatus]?.text,
              )}>
                {STATUS_LABEL[popup.task.status as TaskStatus]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#9CA3AF]">Priority</span>
              <span className="text-[#374151] font-medium">
                {PRIORITY_LABEL[popup.task.priority] || popup.task.priority}
              </span>
            </div>
            {popup.task.owner && (
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">Assignee</span>
                <span className="inline-flex items-center gap-1.5 text-[#374151] font-medium">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-br from-[#8B00FF] to-[#C026D3] text-white text-[7px] font-bold">
                    {popup.task.owner.avatarInitials}
                  </span>
                  {popup.task.owner.fullName}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[#9CA3AF]">Created</span>
              <span className="text-[#374151]">{fmtFullDate(new Date(popup.task.createdAt))}</span>
            </div>
            {popup.task.dueDate && (
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">Due date</span>
                <span className={cn(
                  "font-medium",
                  new Date(popup.task.dueDate) < today ? "text-red-600" : "text-[#374151]"
                )}>
                  {fmtFullDate(new Date(popup.task.dueDate))}
                </span>
              </div>
            )}
            {popup.task.parentLabel && (
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">Related to</span>
                <span className="text-[#8B00FF] font-medium">{popup.task.parentLabel}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
