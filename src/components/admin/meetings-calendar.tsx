"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Phone, Video, MapPin,
  CheckCircle2, XCircle, X,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Meeting = {
  id: string;
  title: string;
  type: string;
  status: string;
  startAt: string;
  endAt: string | null;
  outcome: string;
  nextAction: string;
  notes: string;
  client: { id: string; companyName: string } | null;
  prospect: { id: string; name: string; sector: string } | null;
  owner: { id: string; fullName: string; avatarInitials: string } | null;
};

type MeetingsCalendarProps = {
  onStatusChange: (meeting: Meeting, status: "COMPLETED" | "CANCELLED" | "NO_SHOW" | "SCHEDULED") => void;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CALL: Phone, GOOGLE_MEET: Video, ZOOM: Video, WHATSAPP: FaWhatsapp, IN_PERSON: MapPin,
};
const TYPE_LABEL: Record<string, string> = {
  CALL: "Call", GOOGLE_MEET: "Google Meet", ZOOM: "Zoom", WHATSAPP: "WhatsApp", IN_PERSON: "In person",
};

const STATUS_DOT: Record<string, string> = {
  SCHEDULED: "bg-blue-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-gray-400",
  NO_SHOW: "bg-red-500",
};
const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-100",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  CANCELLED: "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]",
  NO_SHOW: "bg-red-50 text-red-700 border-red-100",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtTime(d: Date) {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  // Monday = 0, Sunday = 6  (ISO weekday)
  let startDow = firstOfMonth.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];

  // Leading blanks
  for (let i = 0; i < startDow; i++) cells.push(null);
  // Month days
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  // Trailing blanks to fill last row
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

function getMonthLabel(year: number, month: number) {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MeetingsCalendar({ onStatusChange }: MeetingsCalendarProps) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [direction, setDirection] = useState(0); // -1 prev, +1 next for animation

  /* -- Fetch meetings for the visible month -------------------------------- */

  const load = useCallback(async () => {
    setLoading(true);
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
    try {
      const res = await fetch(`/api/admin/meetings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=500`);
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (res.ok) setMeetings(await res.json());
    } catch (e) {
      console.warn("[calendar] load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [year, month, router]);

  useEffect(() => { load(); }, [load]);

  /* -- Index meetings by date key ------------------------------------------ */

  const meetingsByDate = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      const d = new Date(m.startAt);
      const key = dateKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    // Sort each day's meetings by time
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    }
    return map;
  }, [meetings]);

  /* -- Grid ---------------------------------------------------------------- */

  const cells = useMemo(() => getMonthGrid(year, month), [year, month]);
  const monthLabel = useMemo(() => getMonthLabel(year, month), [year, month]);

  /* -- Navigation ---------------------------------------------------------- */

  function goMonth(delta: -1 | 1) {
    setDirection(delta);
    setSelectedDate(null);
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  }

  function goToday() {
    setDirection(0);
    setSelectedDate(null);
    setMonth(today.getMonth());
    setYear(today.getFullYear());
  }

  /* -- Selected day's meetings --------------------------------------------- */

  const selectedMeetings = useMemo(() => {
    if (!selectedDate) return [];
    return meetingsByDate.get(dateKey(selectedDate)) ?? [];
  }, [selectedDate, meetingsByDate]);

  /* -- Handle status change and update local state ------------------------- */

  function handleStatusChange(m: Meeting, status: "COMPLETED" | "CANCELLED" | "NO_SHOW" | "SCHEDULED") {
    setMeetings((prev) => prev.map((x) => (x.id === m.id ? { ...x, status } : x)));
    onStatusChange(m, status);
  }

  /* -- Render -------------------------------------------------------------- */

  return (
    <div className="space-y-4">
      {/* Header: month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goMonth(-1)}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#E5E7EB] hover:bg-[#F1F5F9] text-[#475569] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => goMonth(1)}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#E5E7EB] hover:bg-[#F1F5F9] text-[#475569] transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <h2 className="text-[15px] font-semibold text-[#0F172A] ml-2">{monthLabel}</h2>
        </div>
        <button
          onClick={goToday}
          className="text-[12px] font-medium text-[#8B00FF] hover:text-[#7A00E0] px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors"
        >
          Today
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-[#F3F4F6]">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-2.5 text-center text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${year}-${month}`}
            initial={{ opacity: 0, x: direction * 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -30 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="grid grid-cols-7"
          >
            {cells.map((cell, i) => {
              if (!cell) {
                return <div key={`blank-${i}`} className="h-[88px] border-b border-r border-[#F3F4F6] bg-[#FAFAFA]" />;
              }

              const key = dateKey(cell);
              const dayMeetings = meetingsByDate.get(key) ?? [];
              const isToday = isSameDay(cell, today);
              const isSelected = selectedDate ? isSameDay(cell, selectedDate) : false;
              const isWeekend = cell.getDay() === 0 || cell.getDay() === 6;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(isSelected ? null : cell)}
                  className={cn(
                    "h-[88px] border-b border-r border-[#F3F4F6] p-1.5 text-left transition-colors relative group",
                    isSelected
                      ? "bg-purple-50/70 ring-1 ring-inset ring-purple-300"
                      : isToday
                        ? "bg-purple-50/40"
                        : isWeekend
                          ? "bg-[#FAFAFA] hover:bg-[#F5F3FF]/50"
                          : "bg-white hover:bg-[#F8FAFC]",
                  )}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-6 h-6 text-[12px] font-medium rounded-full",
                        isToday
                          ? "bg-[#8B00FF] text-white font-semibold"
                          : isSelected
                            ? "text-[#8B00FF] font-semibold"
                            : "text-[#374151]"
                      )}
                    >
                      {cell.getDate()}
                    </span>
                    {dayMeetings.length > 0 && (
                      <span className="text-[10px] font-medium text-[#9CA3AF]">
                        {dayMeetings.length}
                      </span>
                    )}
                  </div>

                  {/* Meeting dots / pills */}
                  <div className="space-y-0.5 overflow-hidden">
                    {dayMeetings.slice(0, 2).map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate leading-tight",
                          m.status === "SCHEDULED" && "bg-blue-50 text-blue-700",
                          m.status === "COMPLETED" && "bg-emerald-50 text-emerald-700",
                          m.status === "CANCELLED" && "bg-gray-100 text-gray-500",
                          m.status === "NO_SHOW" && "bg-red-50 text-red-700",
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[m.status])} />
                        <span className="truncate">{fmtTime(new Date(m.startAt))}</span>
                      </div>
                    ))}
                    {dayMeetings.length > 2 && (
                      <div className="text-[10px] font-medium text-[#8B00FF] pl-1">
                        +{dayMeetings.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-purple-200 border-t-[#8B00FF] rounded-full animate-spin" />
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        {(["SCHEDULED", "COMPLETED", "NO_SHOW", "CANCELLED"] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[s])} />
            <span className="text-[11px] text-[#6B7280] capitalize">{s.replace("_", " ").toLowerCase()}</span>
          </div>
        ))}
      </div>

      {/* Selected day detail panel */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6]">
              <div>
                <h3 className="text-[14px] font-semibold text-[#0F172A]">
                  {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h3>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                  {selectedMeetings.length === 0
                    ? "No meetings"
                    : `${selectedMeetings.length} meeting${selectedMeetings.length > 1 ? "s" : ""}`}
                </p>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[#F1F5F9] text-[#9CA3AF] hover:text-[#475569] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Meetings list */}
            {selectedMeetings.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-[#9CA3AF]">
                No meetings scheduled for this day
              </div>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {selectedMeetings.map((m) => {
                  const TypeIcon = TYPE_ICON[m.type] ?? Phone;
                  const linkedHref = m.client
                    ? `/admin/clients/${m.client.id}`
                    : m.prospect
                      ? `/admin/prospecting/${m.prospect.id}`
                      : null;
                  const linkedLabel = m.client?.companyName ?? m.prospect?.name ?? "—";
                  const start = new Date(m.startAt);

                  return (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAFE] group">
                      {/* Time */}
                      <div className="text-center w-14 shrink-0">
                        <p className="text-[14px] font-semibold text-[#111827] leading-none">{fmtTime(start)}</p>
                        {m.endAt && (
                          <p className="text-[10px] text-[#9CA3AF] mt-1">{fmtTime(new Date(m.endAt))}</p>
                        )}
                      </div>

                      {/* Type icon */}
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#F3F4F6] text-[#475569] shrink-0">
                        <TypeIcon className="w-4 h-4" />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-[#111827] truncate">{m.title}</p>
                        <div className="flex items-center gap-2 text-[11px] text-[#6B7280] mt-0.5">
                          {linkedHref ? (
                            <Link href={linkedHref} className="hover:text-[#8B00FF] truncate max-w-[200px]">
                              {linkedLabel}
                            </Link>
                          ) : (
                            <span className="text-[#9CA3AF]">{linkedLabel}</span>
                          )}
                          <span>&middot;</span>
                          <span>{TYPE_LABEL[m.type] ?? m.type}</span>
                          {m.owner && (
                            <>
                              <span>&middot;</span>
                              <span>{m.owner.fullName}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status badge */}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0",
                          STATUS_STYLES[m.status] ?? STATUS_STYLES.SCHEDULED
                        )}
                      >
                        {m.status.replace("_", " ")}
                      </span>

                      {/* Quick actions */}
                      {m.status === "SCHEDULED" && (
                        <div className="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(m, "COMPLETED"); }}
                            title="Mark completed"
                            className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(m, "NO_SHOW"); }}
                            title="Mark no-show"
                            className="p-1.5 rounded-md text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
