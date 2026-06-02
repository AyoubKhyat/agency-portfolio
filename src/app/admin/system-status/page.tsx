"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Shield, Users, Target, Calendar, FileText, FolderKanban,
  Database, Wifi, Bell, CheckCircle, AlertTriangle, XCircle,
  RefreshCw, Download, Clock,
} from "lucide-react";
import type React from "react";
import { GlassCard } from "@/components/admin/glass-card";
import { Badge } from "@/components/admin/badge";
import AvatarChip from "@/components/AvatarChip";

type TeamMember = {
  id: string; fullName: string; avatarInitials: string; role: string;
  isActive: boolean; updatedAt: string; lastActivity: string | null;
};

type CheckRecord = Record<string, unknown>;
type Check = {
  id: string;
  label: string;
  count: number;
  severity: "ok" | "warn" | "danger";
  records: CheckRecord[];
  href: string;
};
type Checks = {
  meetings:  Check[];
  contracts: Check[];
  clients:   Check[];
  projects:  Check[];
  tasks:     Check[];
  crm:       Check[];
};

type SystemStatus = {
  dbStatus: string;
  apiStatus: string;
  timestamp: string;
  healthScore?: number;
  team: { total: number; active: number; members: TeamMember[] };
  crm: { total: number; assigned: number; unassigned: number; duplicates: number; missingPhone: number; missingInstagram: number };
  followUps: { overdue: number; dueToday: number; dueThisWeek: number };
  proposals: { draft: number; sent: number; accepted: number; rejected: number };
  projects: { active: number; overdue: number; completed: number };
  system: { unreadNotifications: number; activitiesToday: number };
  checks?: Checks;
};

function StatusDot({ status }: { status: "green" | "yellow" | "red" }) {
  const colors = { green: "bg-emerald-500", yellow: "bg-amber-500", red: "bg-red-500" };
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${colors[status]}`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors[status]}`} />
    </span>
  );
}

function StatusRow({ label, value, icon, status, suffix }: { label: string; value: number; icon: React.ReactNode; status: "green" | "yellow" | "red"; suffix?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-1">
      <div className="flex items-center gap-2.5">
        <StatusDot status={status} />
        <span className="text-[#475569]">{icon}</span>
        <span className="text-[13px] text-[#475569]">{label}</span>
      </div>
      <span className={`text-[14px] font-semibold ${status === "red" ? "text-red-600" : status === "yellow" ? "text-amber-600" : "text-[#0F172A]"}`}>
        {value}{suffix}
      </span>
    </div>
  );
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function SystemStatusPage() {
  const router = useRouter();
  const [data, setData] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function fetchStatus() {
    setRefreshing(true);
    fetch("/api/admin/system-status")
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        if (r.status === 403) { router.push("/admin"); return null; }
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { fetchStatus(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-purple-200 border-t-[#8B00FF] rounded-full animate-spin" />
          <p className="text-[13px] text-[#64748B] font-medium">Running diagnostics...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const overallHealth = data.dbStatus === "ok" && data.apiStatus === "ok" && data.followUps.overdue === 0 && data.projects.overdue === 0
    ? "green" : data.dbStatus !== "ok" ? "red" : "yellow";

  const healthLabel = overallHealth === "green" ? "All systems operational" : overallHealth === "yellow" ? "Attention needed" : "System issues detected";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#8B00FF]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">System Status</h1>
            <p className="text-[13px] text-[#64748B]">Team launch readiness check</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatus}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 border border-[#E5E7EB] rounded-xl text-[13px] text-[#475569] hover:bg-[#F8FAFC] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <a
            href="/api/admin/export?type=prospects&format=csv"
            className="flex items-center gap-2 px-3 py-2 border border-[#E5E7EB] rounded-xl text-[13px] text-[#475569] hover:bg-[#F8FAFC] transition-colors"
          >
            <Download className="w-4 h-4" /> Export
          </a>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassCard padding="lg" className={overallHealth === "green" ? "border-emerald-200 bg-emerald-50/30" : overallHealth === "yellow" ? "border-amber-200 bg-amber-50/30" : "border-red-200 bg-red-50/30"}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatusDot status={overallHealth as "green" | "yellow" | "red"} />
              <div>
                <span className={`text-[15px] font-semibold ${overallHealth === "green" ? "text-emerald-700" : overallHealth === "yellow" ? "text-amber-700" : "text-red-700"}`}>
                  {healthLabel}
                </span>
                <p className="text-[12px] text-[#64748B] mt-0.5">
                  Last checked: {new Date(data.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}{data.system.activitiesToday} activities today
                </p>
              </div>
            </div>
            {typeof data.healthScore === "number" && (
              <div className={`text-right ${data.healthScore >= 85 ? "text-emerald-700" : data.healthScore >= 65 ? "text-amber-700" : "text-red-700"}`}>
                <div className="text-3xl font-bold leading-none">{data.healthScore}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mt-1">Health score</div>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {data.checks && <ChecksSection checks={data.checks} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <GlassCard padding="lg" className="h-full">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-[#8B00FF]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Team Status</h3>
              <Badge variant="purple" size="sm">{data.team.active}/{data.team.total}</Badge>
            </div>
            <div className="space-y-2.5">
              {data.team.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-1.5">
                  <AvatarChip initials={m.avatarInitials} name={m.fullName} showName={false} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[#0F172A] truncate">{m.fullName}</span>
                      <Badge variant={m.isActive ? "green" : "red"} size="sm" dot>{m.isActive ? "Active" : "Inactive"}</Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-[#94A3B8]" />
                      <span className="text-[11px] text-[#64748B]">Last active: {relativeTime(m.lastActivity)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlassCard padding="lg" className="h-full">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-[#8B00FF]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">CRM Status</h3>
              <Badge variant="default" size="sm">{data.crm.total}</Badge>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <StatusRow label="Assigned" value={data.crm.assigned} icon={<CheckCircle className="w-3.5 h-3.5" />} status="green" />
              <StatusRow label="Unassigned" value={data.crm.unassigned} icon={<AlertTriangle className="w-3.5 h-3.5" />} status={data.crm.unassigned > 10 ? "yellow" : "green"} />
              <StatusRow label="Duplicates" value={data.crm.duplicates} icon={<XCircle className="w-3.5 h-3.5" />} status={data.crm.duplicates > 0 ? "yellow" : "green"} />
              <StatusRow label="Missing phone" value={data.crm.missingPhone} icon={<AlertTriangle className="w-3.5 h-3.5" />} status={data.crm.missingPhone > 5 ? "yellow" : "green"} />
              <StatusRow label="Missing Instagram" value={data.crm.missingInstagram} icon={<AlertTriangle className="w-3.5 h-3.5" />} status="green" />
            </div>
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <GlassCard padding="lg" className="h-full">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-[#8B00FF]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Follow-up Status</h3>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <StatusRow label="Overdue" value={data.followUps.overdue} icon={<XCircle className="w-3.5 h-3.5" />} status={data.followUps.overdue > 0 ? "red" : "green"} />
              <StatusRow label="Due today" value={data.followUps.dueToday} icon={<AlertTriangle className="w-3.5 h-3.5" />} status={data.followUps.dueToday > 0 ? "yellow" : "green"} />
              <StatusRow label="Due this week" value={data.followUps.dueThisWeek} icon={<Clock className="w-3.5 h-3.5" />} status="green" />
            </div>
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <GlassCard padding="lg" className="h-full">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-[#8B00FF]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Proposal Status</h3>
              <Badge variant="default" size="sm">{data.proposals.draft + data.proposals.sent + data.proposals.accepted + data.proposals.rejected}</Badge>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <StatusRow label="Draft" value={data.proposals.draft} icon={<FileText className="w-3.5 h-3.5" />} status="green" />
              <StatusRow label="Sent" value={data.proposals.sent} icon={<CheckCircle className="w-3.5 h-3.5" />} status={data.proposals.sent > 0 ? "yellow" : "green"} />
              <StatusRow label="Accepted" value={data.proposals.accepted} icon={<CheckCircle className="w-3.5 h-3.5" />} status="green" />
              <StatusRow label="Rejected" value={data.proposals.rejected} icon={<XCircle className="w-3.5 h-3.5" />} status={data.proposals.rejected > 0 ? "yellow" : "green"} />
            </div>
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <GlassCard padding="lg" className="h-full">
            <div className="flex items-center gap-2 mb-4">
              <FolderKanban className="w-4 h-4 text-[#8B00FF]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Project Status</h3>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <StatusRow label="Active" value={data.projects.active} icon={<CheckCircle className="w-3.5 h-3.5" />} status="green" />
              <StatusRow label="Overdue" value={data.projects.overdue} icon={<XCircle className="w-3.5 h-3.5" />} status={data.projects.overdue > 0 ? "red" : "green"} />
              <StatusRow label="Completed" value={data.projects.completed} icon={<CheckCircle className="w-3.5 h-3.5" />} status="green" />
            </div>
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <GlassCard padding="lg" className="h-full">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-[#8B00FF]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">System Health</h3>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <div className="flex items-center justify-between py-2.5 px-1">
                <div className="flex items-center gap-2.5">
                  <StatusDot status={data.dbStatus === "ok" ? "green" : "red"} />
                  <Database className="w-3.5 h-3.5 text-[#475569]" />
                  <span className="text-[13px] text-[#475569]">Database</span>
                </div>
                <Badge variant={data.dbStatus === "ok" ? "green" : "red"} size="sm">{data.dbStatus === "ok" ? "Connected" : "Down"}</Badge>
              </div>
              <div className="flex items-center justify-between py-2.5 px-1">
                <div className="flex items-center gap-2.5">
                  <StatusDot status={data.apiStatus === "ok" ? "green" : "red"} />
                  <Wifi className="w-3.5 h-3.5 text-[#475569]" />
                  <span className="text-[13px] text-[#475569]">API</span>
                </div>
                <Badge variant={data.apiStatus === "ok" ? "green" : "red"} size="sm">{data.apiStatus === "ok" ? "Healthy" : "Error"}</Badge>
              </div>
              <div className="flex items-center justify-between py-2.5 px-1">
                <div className="flex items-center gap-2.5">
                  <StatusDot status={data.system.unreadNotifications > 20 ? "yellow" : "green"} />
                  <Bell className="w-3.5 h-3.5 text-[#475569]" />
                  <span className="text-[13px] text-[#475569]">Notifications</span>
                </div>
                <Badge variant={data.system.unreadNotifications > 20 ? "amber" : "green"} size="sm">{data.system.unreadNotifications} unread</Badge>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}

function ChecksSection({ checks }: { checks: Checks }) {
  const groups: { key: keyof Checks; title: string; icon: React.ReactNode }[] = [
    { key: "meetings",  title: "Meetings",  icon: <Calendar  className="w-4 h-4 text-blue-600" /> },
    { key: "contracts", title: "Contracts", icon: <FileText className="w-4 h-4 text-emerald-600" /> },
    { key: "clients",   title: "Clients",   icon: <Users    className="w-4 h-4 text-purple-600" /> },
    { key: "projects",  title: "Projects",  icon: <FolderKanban className="w-4 h-4 text-cyan-600" /> },
    { key: "tasks",     title: "Tasks",     icon: <Target   className="w-4 h-4 text-amber-600" /> },
    { key: "crm",       title: "CRM data",  icon: <Database className="w-4 h-4 text-[#8B00FF]" /> },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {groups.map((g) => (
          <GlassCard key={g.key} padding="lg">
            <div className="flex items-center gap-2 mb-3">
              {g.icon}
              <h3 className="text-[14px] font-semibold text-[#0F172A]">{g.title}</h3>
            </div>
            <div className="space-y-1">
              {checks[g.key].map((c) => <CheckRow key={c.id} c={c} />)}
            </div>
          </GlassCard>
        ))}
      </div>
    </motion.div>
  );
}

function CheckRow({ c }: { c: Check }) {
  const tone =
    c.severity === "danger" ? { dot: "bg-red-500",     text: "text-red-700",     bg: "hover:bg-red-50" } :
    c.severity === "warn"   ? { dot: "bg-amber-500",   text: "text-amber-700",   bg: "hover:bg-amber-50" } :
                              { dot: "bg-emerald-500", text: "text-[#475569]",   bg: "hover:bg-[#F8FAFC]" };
  const content = (
    <div className={`flex items-center justify-between py-2 px-2 rounded-lg ${tone.bg} transition-colors`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
        <span className="text-[13px] text-[#475569] truncate">{c.label}</span>
      </div>
      <span className={`text-[13px] font-semibold ${tone.text} shrink-0`}>{c.count}</span>
    </div>
  );
  if (c.count === 0) return content;
  return (
    <a href={c.href} className="block">{content}</a>
  );
}
