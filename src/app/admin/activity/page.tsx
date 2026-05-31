"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Send,
  CheckCircle,
  UserPlus,
  Plus,
  Trophy,
  FileText,
  Activity,
  Reply,
  Star,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { GlassCard } from "@/components/admin/glass-card";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { EmptyState } from "@/components/admin/empty-state";
import AvatarChip from "@/components/AvatarChip";

const ACTION_LABELS: Record<string, string> = {
  CREATED: "created prospect",
  ASSIGNED: "assigned prospect",
  SENT_WHATSAPP: "sent WhatsApp to",
  SENT_INSTAGRAM: "sent Instagram DM to",
  FOLLOW_UP: "sent follow-up to",
  MARKED_REPLIED: "marked as replied",
  MARKED_NO_WHATSAPP: "marked as no WhatsApp",
  STATUS_ENVOYE: "changed status to Sent for",
  STATUS_REPONDU: "marked as replied",
  STATUS_A_ENVOYER: "reset to To Send",
  STATUS_CONVERTI: "converted to lead",
  STATUS_PAS_DE_WHATSAPP: "marked no WhatsApp",
  NOTE_ADDED: "added a note to",
  UPDATED: "updated",
  BACKFILL_OWNERSHIP: "was attributed to",
};

const ACTION_ICONS: Record<string, typeof Activity> = {
  SENT_WHATSAPP: MessageCircle,
  SENT_INSTAGRAM: MessageCircle,
  FOLLOW_UP: Send,
  MARKED_REPLIED: CheckCircle,
  ASSIGNED: UserPlus,
  CREATED: Plus,
  STATUS_CONVERTI: Trophy,
  NOTE_ADDED: FileText,
  default: Activity,
};

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  SENT_WHATSAPP: { bg: "bg-green-100", text: "text-green-600" },
  SENT_INSTAGRAM: { bg: "bg-pink-100", text: "text-pink-600" },
  FOLLOW_UP: { bg: "bg-blue-100", text: "text-blue-600" },
  MARKED_REPLIED: { bg: "bg-emerald-100", text: "text-emerald-600" },
  STATUS_REPONDU: { bg: "bg-emerald-100", text: "text-emerald-600" },
  ASSIGNED: { bg: "bg-violet-100", text: "text-violet-600" },
  CREATED: { bg: "bg-slate-100", text: "text-slate-600" },
  STATUS_CONVERTI: { bg: "bg-amber-100", text: "text-amber-600" },
  NOTE_ADDED: { bg: "bg-sky-100", text: "text-sky-600" },
  default: { bg: "bg-gray-100", text: "text-gray-500" },
};

type ActivityItem = {
  id: string;
  userId: string;
  userName: string;
  actionType: string;
  previousStatus: string | null;
  newStatus: string | null;
  details: string | null;
  createdAt: string;
  prospect: { id: string; name: string; sector: string };
};

type TeamStat = {
  user: { id: string; fullName: string; avatarInitials: string; role: string };
  assigned: number;
  sent: number;
  contacted: number;
  replied: number;
  converted: number;
  replyRate: number;
  conversionRate: number;
  lastActivity: string | null;
};

type TeamUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarInitials: string;
  isActive: boolean;
};

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return "Today";
  }
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return "Yesterday";
  }
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const FILTER_ITEMS = [
  { value: "ALL", label: "All" },
  { value: "ASSIGNED", label: "Assignments" },
  { value: "SENT", label: "Sent" },
  { value: "REPLIED", label: "Replies" },
  { value: "CONVERTED", label: "Conversions" },
];

const SENT_TYPES = ["SENT_WHATSAPP", "SENT_INSTAGRAM", "FOLLOW_UP"];
const REPLIED_TYPES = ["MARKED_REPLIED", "STATUS_REPONDU"];
const CONVERTED_TYPES = ["STATUS_CONVERTI"];

function matchesFilter(actionType: string, filter: string): boolean {
  if (filter === "ALL") return true;
  if (filter === "ASSIGNED") return actionType === "ASSIGNED";
  if (filter === "SENT") return SENT_TYPES.includes(actionType);
  if (filter === "REPLIED") return REPLIED_TYPES.includes(actionType);
  if (filter === "CONVERTED") return CONVERTED_TYPES.includes(actionType);
  return true;
}

export default function ActivityPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStat[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("ALL");
  const [filterUser, setFilterUser] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/activity?limit=100").then((r) => {
        if (r.status === 401) {
          router.push("/admin/login");
          return [];
        }
        return r.ok ? r.json() : [];
      }),
      fetch("/api/admin/team-stats")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch("/api/admin/users")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([actData, statsData, usersData]) => {
      setActivities(actData);
      setTeamStats(statsData);
      setTeamUsers(usersData);
      setLoading(false);
    });
  }, [router]);

  const todayActivities = useMemo(
    () => activities.filter((a) => isToday(a.createdAt)),
    [activities]
  );

  const contactsToday = useMemo(
    () => todayActivities.filter((a) => a.actionType.includes("SENT")).length,
    [todayActivities]
  );

  const repliesToday = useMemo(
    () => todayActivities.filter((a) => a.actionType.includes("REPLIED")).length,
    [todayActivities]
  );

  const conversionsToday = useMemo(
    () => todayActivities.filter((a) => a.actionType.includes("CONVERTI")).length,
    [todayActivities]
  );

  const activeMembersToday = useMemo(
    () => new Set(todayActivities.map((a) => a.userId)).size,
    [todayActivities]
  );

  const filteredActivities = useMemo(() => {
    let result = activities;
    if (filterType !== "ALL") {
      result = result.filter((a) => matchesFilter(a.actionType, filterType));
    }
    if (filterUser) {
      result = result.filter((a) => a.userId === filterUser);
    }
    return result;
  }, [activities, filterType, filterUser]);

  const grouped = useMemo(() => {
    const groups: Record<string, ActivityItem[]> = {};
    for (const item of filteredActivities) {
      const key = new Date(item.createdAt).toDateString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [filteredActivities]);

  const sortedStats = useMemo(
    () => [...teamStats].sort((a, b) => b.sent - a.sent),
    [teamStats]
  );

  const maxSent = useMemo(
    () => Math.max(...sortedStats.map((s) => s.sent), 1),
    [sortedStats]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-purple-200 border-t-[#8B00FF] rounded-full animate-spin" />
          <p className="text-[13px] text-[#64748B] font-medium">Loading activity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Feed"
        subtitle="Team actions in real time"
        count={activities.length}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          value={contactsToday}
          label="Contacts Today"
          icon={<Send size={18} />}
          index={0}
        />
        <StatCard
          value={repliesToday}
          label="Replies Today"
          icon={<Reply size={18} />}
          accent
          index={1}
        />
        <StatCard
          value={conversionsToday}
          label="Conversions Today"
          icon={<Star size={18} />}
          index={2}
        />
        <StatCard
          value={activeMembersToday}
          label="Active Members"
          icon={<Users size={18} />}
          index={3}
        />
      </div>

      <FilterTabs
        items={FILTER_ITEMS}
        active={filterType}
        onChange={setFilterType}
      />

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setFilterUser(null)}
          className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all shrink-0 ${
            filterUser === null
              ? "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-sm"
              : "bg-white text-[#475569] border border-[#E2E8F0] hover:border-[#CBD5E1]"
          }`}
        >
          All Members
        </button>
        {teamUsers.map((u) => (
          <AvatarChip
            key={u.id}
            initials={u.avatarInitials}
            name={u.fullName}
            showName
            size="sm"
            onClick={() => setFilterUser(filterUser === u.id ? null : u.id)}
            active={filterUser === u.id}
          />
        ))}
      </div>

      {sortedStats.length > 0 && (
        <GlassCard padding="lg">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10">
              <Trophy size={16} className="text-[#8B00FF]" />
            </div>
            <h3 className="text-[15px] font-semibold text-[#0F172A]">Team Leaderboard</h3>
          </div>
          <div className="space-y-3">
            {sortedStats.map((stat, i) => {
              const barWidth = (stat.sent / maxSent) * 100;
              return (
                <motion.div
                  key={stat.user.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-[12px] font-bold text-[#64748B] w-5 text-right shrink-0">
                    {i + 1}
                  </span>
                  <AvatarChip
                    initials={stat.user.avatarInitials}
                    name={stat.user.fullName}
                    showName={false}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-medium text-[#0F172A] truncate">
                        {stat.user.fullName}
                      </span>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-[11px] text-[#64748B]">
                          <span className="font-semibold text-[#0F172A]">{stat.sent}</span> sent
                        </span>
                        <span className="text-[11px] text-[#64748B]">
                          <span className="font-semibold text-emerald-600">{stat.replied}</span> replied
                        </span>
                        <span className="text-[11px] text-[#64748B]">
                          <span className="font-semibold text-amber-600">{stat.converted}</span> converted
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{
                          duration: 0.8,
                          delay: 0.2 + i * 0.06,
                          ease: [0.25, 0.46, 0.45, 0.94],
                        }}
                        className="h-full rounded-full bg-gradient-to-r from-[#8B00FF] to-[#C026D3]"
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {filteredActivities.length === 0 ? (
        <EmptyState
          icon={<Activity size={28} />}
          title="No activity found"
          description="No actions match the current filters. Try adjusting your selection."
        />
      ) : (
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {Object.entries(grouped).map(([dateKey, items]) => (
              <motion.div
                key={dateKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    {formatDateGroup(items[0].createdAt)}
                  </h3>
                  <div className="flex-1 h-px bg-[#E2E8F0]" />
                  <span className="text-[11px] text-[#94A3B8] font-medium">
                    {items.length} action{items.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <GlassCard padding="none">
                  <div className="divide-y divide-[#F1F5F9]">
                    {items.map((a, idx) => {
                      const IconComponent = ACTION_ICONS[a.actionType] || ACTION_ICONS.default;
                      const colors = ACTION_COLORS[a.actionType] || ACTION_COLORS.default;
                      return (
                        <motion.div
                          key={a.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                          className="flex items-start gap-3 px-4 sm:px-5 py-3.5 hover:bg-[#FAFBFC] transition-colors"
                        >
                          <div
                            className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 mt-0.5 ${colors.bg} ${colors.text}`}
                          >
                            <IconComponent size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] text-[#475569] leading-relaxed">
                              <span className="font-semibold text-[#0F172A]">{a.userName}</span>{" "}
                              {ACTION_LABELS[a.actionType] ?? a.actionType}{" "}
                              <Link
                                href={`/admin/prospecting/${a.prospect.id}`}
                                className="font-semibold text-[#8B00FF] hover:text-[#7600D6] transition-colors"
                              >
                                {a.prospect.name}
                              </Link>
                            </p>
                            {a.details && a.actionType === "NOTE_ADDED" && (
                              <div className="mt-1.5 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                                <p className="text-[12px] text-[#475569] italic leading-relaxed">
                                  &ldquo;{a.details}&rdquo;
                                </p>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-[#94A3B8]">{a.prospect.sector}</span>
                            </div>
                          </div>
                          <span className="text-[11px] text-[#94A3B8] font-medium shrink-0 mt-0.5">
                            {relativeTime(a.createdAt)}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
