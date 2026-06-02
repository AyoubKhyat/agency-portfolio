"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { HiOutlinePlus, HiOutlineUsers, HiOutlineUserGroup, HiOutlineClipboardDocumentList, HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { GlassCard } from "@/components/admin/glass-card";
import { Badge } from "@/components/admin/badge";
import { EmptyState } from "@/components/admin/empty-state";
import { Field, Input, Select, FormButton, FormError } from "@/components/admin/form";
import AvatarChip from "@/components/AvatarChip";

type User = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarInitials: string;
  isActive: boolean;
  createdAt: string;
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
  lastActionType: string | null;
};

const ROLES = ["admin", "sales", "designer", "developer"];

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: "bg-violet-100", text: "text-violet-700" },
  sales: { bg: "bg-blue-100", text: "text-blue-700" },
  designer: { bg: "bg-pink-100", text: "text-pink-700" },
  developer: { bg: "bg-emerald-100", text: "text-emerald-700" },
};

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function TeamPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<TeamStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ fullName: "", email: "", password: "", role: "sales", avatarInitials: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        if (r.status === 403) { router.push("/admin"); return null; }
        return r.json();
      }),
      fetch("/api/admin/team-stats").then((r) => (r.ok ? r.json() : [])),
    ]).then(([usersData, statsData]) => {
      if (usersData) setUsers(usersData);
      if (statsData) setStats(statsData);
      setLoading(false);
    });
  }, [router]);

  async function handleToggleActive(user: User) {
    if (!confirm(`${user.isActive ? "Deactivate" : "Activate"} ${user.fullName}?`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (res.ok) setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u)));
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    const initials =
      formData.avatarInitials ||
      formData.fullName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, avatarInitials: initials }),
    });
    if (res.ok) {
      const user = await res.json();
      setUsers((prev) => [...prev, user]);
      setFormData({ fullName: "", email: "", password: "", role: "sales", avatarInitials: "" });
      setShowForm(false);
    } else {
      const data = await res.json();
      setFormError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
    }
    setSaving(false);
  }

  const totalAssigned = stats.reduce((sum, s) => sum + s.assigned, 0);
  const totalContacted = stats.reduce((sum, s) => sum + s.contacted, 0);
  const activeUsers = users.filter((u) => u.isActive).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-purple-300 border-t-[#8B00FF] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Team"
        subtitle="Manage team members and performance"
        count={users.length}
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white rounded-xl text-[13px] font-medium shadow-sm shadow-purple-200 hover:shadow-md hover:shadow-purple-300 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <HiOutlinePlus className="w-4 h-4" />
            Add Member
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard value={users.length} label="Team Members" icon={<HiOutlineUsers className="w-5 h-5" />} index={0} />
        <StatCard value={activeUsers} label="Active Members" icon={<HiOutlineUserGroup className="w-5 h-5" />} index={1} />
        <StatCard value={totalAssigned} label="Assigned Prospects" icon={<HiOutlineClipboardDocumentList className="w-5 h-5" />} index={2} />
        <StatCard value={totalContacted} label="Total Contacted" icon={<HiOutlineChatBubbleLeftRight className="w-5 h-5" />} index={3} accent />
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <GlassCard padding="lg">
              <form onSubmit={handleCreateUser} className="space-y-5">
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B00FF]/10 to-[#C026D3]/10">
                    <HiOutlinePlus className="w-4 h-4 text-[#8B00FF]" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#0F172A]">New team member</h3>
                    <p className="text-[12px] text-[#64748B] mt-0.5">They&apos;ll get access to the admin OS based on their role.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Full name" required>
                    <Input
                      value={formData.fullName}
                      onChange={(e) => setFormData((d) => ({ ...d, fullName: e.target.value }))}
                      required
                      placeholder="Ayoub Khyat"
                    />
                  </Field>
                  <Field label="Email" required>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                      required
                      placeholder="name@ibda3digital.com"
                    />
                  </Field>
                  <Field label="Password" required hint="At least 6 characters.">
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData((d) => ({ ...d, password: e.target.value }))}
                      required
                      minLength={6}
                      placeholder="••••••••"
                    />
                  </Field>
                  <Field label="Role">
                    <Select
                      value={formData.role}
                      onChange={(e) => setFormData((d) => ({ ...d, role: e.target.value }))}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <FormError message={formError} />
                <div className="flex gap-2 pt-1">
                  <FormButton type="submit" variant="primary" loading={saving}>
                    {saving ? "Creating..." : "Create member"}
                  </FormButton>
                  <FormButton type="button" variant="secondary" onClick={() => setShowForm(false)}>
                    Cancel
                  </FormButton>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {users.length === 0 ? (
        <EmptyState
          icon={<HiOutlineUsers className="w-7 h-7" />}
          title="No team members yet"
          description="Add your first team member to start tracking performance and assigning prospects."
          action={
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white rounded-xl text-[13px] font-medium shadow-sm shadow-purple-200 hover:shadow-md hover:shadow-purple-300 transition-all"
            >
              <HiOutlinePlus className="w-4 h-4" />
              Add Member
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {stats.map((s, i) => {
            const user = users.find((u) => u.id === s.user.id);
            const isActive = user?.isActive ?? true;
            const workload = s.assigned > 0 ? Math.round((s.contacted / s.assigned) * 100) : 0;

            return (
              <GlassCard
                key={s.user.id}
                hover
                glow
                padding="none"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <div className="p-5 pb-0">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarChip initials={s.user.avatarInitials} name={s.user.fullName} size="md" showName={false} />
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#0F172A] truncate">{s.user.fullName}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant={s.user.role === "admin" ? "purple" : s.user.role === "sales" ? "blue" : s.user.role === "designer" ? "red" : "green"} size="sm">
                            {s.user.role.charAt(0).toUpperCase() + s.user.role.slice(1)}
                          </Badge>
                          <Badge variant={isActive ? "green" : "red"} size="sm" dot>
                            {isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-x-4 gap-y-3 mb-4">
                    <div>
                      <p className="text-xl font-bold text-[#0F172A]">{s.assigned}</p>
                      <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mt-0.5">Assigned</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-blue-600">{s.sent}</p>
                      <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mt-0.5">Sent</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-[#0F172A]">{s.contacted}</p>
                      <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mt-0.5">Contacted</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-emerald-600">{s.replied}</p>
                      <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mt-0.5">Replies</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-[#8B00FF]">{s.converted}</p>
                      <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mt-0.5">Converted</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-medium text-[#475569]">Workload Progress</span>
                      <span className="text-[11px] font-semibold text-[#0F172A]">{workload}%</span>
                    </div>
                    <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[#8B00FF] to-[#C026D3]"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(workload, 100)}%` }}
                        transition={{ duration: 0.8, delay: i * 0.06 + 0.3, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#F1F5F9] px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[13px] font-semibold text-[#0F172A]">{s.replyRate}%</p>
                      <p className="text-[10px] text-[#64748B]">Reply Rate</p>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#0F172A]">{s.conversionRate}%</p>
                      <p className="text-[10px] text-[#64748B]">Conversion</p>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#0F172A]">{relativeDate(s.lastActivity)}</p>
                      <p className="text-[10px] text-[#64748B]">Last Active</p>
                    </div>
                  </div>
                  {user && (
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                        user.isActive
                          ? "text-red-600 bg-red-50 hover:bg-red-100"
                          : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                      }`}
                    >
                      {user.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
