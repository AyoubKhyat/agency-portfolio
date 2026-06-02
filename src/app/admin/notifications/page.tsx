"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell, AtSign, CheckSquare, TrendingUp, Layers, AlertCircle, Loader2,
  CheckCheck, Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

type Filter = "all" | "unread" | "mentions" | "tasks" | "deals";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all",      label: "All" },
  { value: "unread",   label: "Unread" },
  { value: "mentions", label: "Mentions" },
  { value: "tasks",    label: "Tasks" },
  { value: "deals",    label: "Deals" },
];

const TYPE_STYLES: Record<string, { icon: React.ComponentType<{ className?: string }>; tint: string; chip: string }> = {
  MENTION:                { icon: AtSign,        tint: "text-purple-600",   chip: "bg-purple-50 text-purple-700 border-purple-100" },
  TASK_ASSIGNED:          { icon: CheckSquare,   tint: "text-blue-600",     chip: "bg-blue-50 text-blue-700 border-blue-100" },
  TASK_DUE:               { icon: AlertCircle,   tint: "text-amber-600",    chip: "bg-amber-50 text-amber-700 border-amber-100" },
  CLIENT_STATUS_CHANGED:  { icon: Layers,        tint: "text-emerald-600",  chip: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  ACCOUNT_ASSIGNED:       { icon: Layers,        tint: "text-emerald-600",  chip: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  conversion:             { icon: TrendingUp,    tint: "text-emerald-600",  chip: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  PROPOSAL_ACCEPTED:      { icon: TrendingUp,    tint: "text-emerald-600",  chip: "bg-emerald-50 text-emerald-700 border-emerald-100" },
};

function typeMeta(type: string) {
  return TYPE_STYLES[type] ?? { icon: Bell, tint: "text-[#6B7280]", chip: "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]" };
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function bucket(iso: string): "today" | "yesterday" | "earlier" {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const itemDay = new Date(d); itemDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - itemDay.getTime()) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  return "earlier";
}

function applyFilter(notifs: Notification[], filter: Filter): Notification[] {
  if (filter === "all") return notifs;
  if (filter === "unread") return notifs.filter((n) => !n.read);
  if (filter === "mentions") return notifs.filter((n) => n.type === "MENTION");
  if (filter === "tasks") return notifs.filter((n) => n.type.startsWith("TASK_"));
  if (filter === "deals") return notifs.filter((n) => ["PROPOSAL_ACCEPTED", "conversion", "CLIENT_STATUS_CHANGED", "ACCOUNT_ASSIGNED"].includes(n.type));
  return notifs;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetch("/api/admin/notifications?limit=200")
      .then((r) => { if (r.status === 401) { router.push("/admin/login"); return null; } return r.json(); })
      .then((d) => { if (Array.isArray(d)) setNotifs(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const unreadCount = useMemo(() => notifs.filter((n) => !n.read).length, [notifs]);
  const tabItems = useMemo(() => FILTERS.map((f) => ({
    value: f.value,
    label: f.label,
    count: applyFilter(notifs, f.value).length,
  })), [notifs]);

  const filtered = useMemo(() => applyFilter(notifs, filter), [notifs, filter]);

  const grouped = useMemo(() => {
    const groups: Record<"today" | "yesterday" | "earlier", Notification[]> = { today: [], yesterday: [], earlier: [] };
    for (const n of filtered) groups[bucket(n.createdAt)].push(n);
    return groups;
  }, [filtered]);

  async function markRead(notif: Notification) {
    if (notif.read) return;
    setNotifs((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notif.id }),
    });
  }

  async function markAllRead() {
    if (marking || unreadCount === 0) return;
    setMarking(true);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setMarking(false);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
        actions={
          <button
            type="button"
            onClick={markAllRead}
            disabled={marking || unreadCount === 0}
            className="inline-flex items-center gap-1.5 h-10 px-3 bg-white border border-[#D1D5DB] text-[#374151] rounded-lg text-[12px] font-medium hover:bg-[#F9FAFB] disabled:opacity-50"
          >
            {marking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
            Mark all read
          </button>
        }
      />

      <div className="mb-4">
        <FilterTabs items={tabItems} active={filter} onChange={(v) => setFilter(v as Filter)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-[#8B00FF] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-7 h-7" />}
          title={filter === "unread" ? "No unread notifications" : "No notifications yet"}
          description="Mentions, task assignments and key client events will appear here."
        />
      ) : (
        <div className="space-y-6">
          {(["today", "yesterday", "earlier"] as const).map((k) => grouped[k].length > 0 && (
            <section key={k}>
              <h3 className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2 px-1">
                {k === "today" ? "Today" : k === "yesterday" ? "Yesterday" : "Earlier"}
              </h3>
              <div className="bg-white border border-[#E5E7EB] rounded-xl divide-y divide-[#F3F4F6] overflow-hidden">
                {grouped[k].map((n) => <Row key={n.id} n={n} onClick={() => markRead(n)} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ n, onClick }: { n: Notification; onClick: () => void }) {
  const meta = typeMeta(n.type);
  const Icon = meta.icon;
  const content = (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-[#FAFAFE]",
        !n.read && "bg-[#FAFAFE]",
      )}
    >
      <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg shrink-0", meta.chip)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-[13px] leading-snug", n.read ? "text-[#475569]" : "text-[#111827] font-medium")}>
            {n.title}
          </p>
          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#8B00FF] mt-1.5 shrink-0" />}
        </div>
        {n.body && (
          <p className="text-[12px] text-[#6B7280] mt-0.5 line-clamp-2">{n.body}</p>
        )}
        <p className="text-[11px] text-[#9CA3AF] mt-1">{relativeDate(n.createdAt)}</p>
      </div>
    </div>
  );
  if (n.link) {
    return (
      <Link href={n.link} className="block">{content}</Link>
    );
  }
  return content;
}
