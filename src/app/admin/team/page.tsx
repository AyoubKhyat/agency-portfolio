"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AvatarChip from "@/components/AvatarChip";
import { HiOutlinePlus } from "react-icons/hi2";

type User = { id: string; fullName: string; email: string; role: string; avatarInitials: string; isActive: boolean; createdAt: string };
type TeamStat = {
  user: { id: string; fullName: string; avatarInitials: string; role: string };
  assigned: number; sent: number; contacted: number; replied: number; converted: number;
  replyRate: number; conversionRate: number; lastActivity: string | null; lastActionType: string | null;
};

const ROLES = ["admin", "sales", "designer", "developer"];
const ROLE_COLORS: Record<string, string> = { admin: "bg-violet-50 text-violet-600", sales: "bg-blue-50 text-blue-600", designer: "bg-pink-50 text-pink-600", developer: "bg-emerald-50 text-emerald-600" };

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
      fetch("/api/admin/users").then((r) => { if (r.status === 401) { router.push("/admin/login"); return null; } if (r.status === 403) { router.push("/admin"); return null; } return r.json(); }),
      fetch("/api/admin/team-stats").then((r) => r.ok ? r.json() : []),
    ]).then(([usersData, statsData]) => { if (usersData) setUsers(usersData); if (statsData) setStats(statsData); setLoading(false); });
  }, [router]);

  async function handleToggleActive(user: User) {
    if (!confirm(`${user.isActive ? "Deactivate" : "Activate"} ${user.fullName}?`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !user.isActive }) });
    if (res.ok) setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault(); setFormError(""); setSaving(true);
    const initials = formData.avatarInitials || formData.fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formData, avatarInitials: initials }) });
    if (res.ok) { const user = await res.json(); setUsers((prev) => [...prev, user]); setFormData({ fullName: "", email: "", password: "", role: "sales", avatarInitials: "" }); setShowForm(false); }
    else { const data = await res.json(); setFormError(typeof data.error === "string" ? data.error : JSON.stringify(data.error)); }
    setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Team</h1>
          <p className="text-sm text-gray-400 mt-0.5">{users.length} members</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-[13px] font-medium shadow-sm shadow-violet-200 hover:shadow-md hover:shadow-violet-200 transition-all">
          <HiOutlinePlus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {/* Add user form */}
      {showForm && (
        <form onSubmit={handleCreateUser} className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 space-y-4">
          <h3 className="text-[15px] font-semibold text-gray-900 mb-2">New Team Member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-gray-600 mb-1.5">Full Name</label>
              <input value={formData.fullName} onChange={(e) => setFormData((d) => ({ ...d, fullName: e.target.value }))} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-600 mb-1.5">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-600 mb-1.5">Password</label>
              <input type="password" value={formData.password} onChange={(e) => setFormData((d) => ({ ...d, password: e.target.value }))} required minLength={6} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-600 mb-1.5">Role</label>
              <select value={formData.role} onChange={(e) => setFormData((d) => ({ ...d, role: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 cursor-pointer">
                {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
          </div>
          {formError && <div className="px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl"><p className="text-red-600 text-[13px]">{formError}</p></div>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-[13px] font-medium hover:bg-gray-800 transition-colors disabled:opacity-40">{saving ? "Creating..." : "Create"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-[13px] font-medium hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* Team members */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 mb-10">
        {users.map((user) => (
          <div key={user.id} className="flex items-center gap-4 px-6 py-4">
            <AvatarChip initials={user.avatarInitials} name={user.fullName} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-gray-400">{user.email}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase ${ROLE_COLORS[user.role] ?? "bg-gray-50 text-gray-500"}`}>{user.role}</span>
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold ${user.isActive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>{user.isActive ? "Active" : "Inactive"}</span>
            <button onClick={() => handleToggleActive(user)} className={`px-3 py-1.5 rounded-xl text-[12px] font-medium transition-colors ${user.isActive ? "text-red-500 bg-red-50 hover:bg-red-100" : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"}`}>
              {user.isActive ? "Deactivate" : "Activate"}
            </button>
          </div>
        ))}
      </div>

      {/* Performance */}
      <h2 className="text-xl font-semibold text-gray-900 mb-5">Performance</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.user.id} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:shadow-gray-100/50 transition-all">
            <div className="flex items-center gap-3 mb-5">
              <AvatarChip initials={s.user.avatarInitials} name={s.user.fullName} size="md" />
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase ${ROLE_COLORS[s.user.role] ?? ""}`}>{s.user.role}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div><p className="text-2xl font-semibold text-gray-900">{s.assigned}</p><p className="text-[11px] text-gray-400 uppercase tracking-wide">Assigned</p></div>
              <div><p className="text-2xl font-semibold text-blue-600">{s.sent}</p><p className="text-[11px] text-gray-400 uppercase tracking-wide">Sent</p></div>
              <div><p className="text-2xl font-semibold text-gray-900">{s.contacted}</p><p className="text-[11px] text-gray-400 uppercase tracking-wide">Contacted</p></div>
              <div><p className="text-2xl font-semibold text-emerald-600">{s.replied}</p><p className="text-[11px] text-gray-400 uppercase tracking-wide">Replies</p></div>
              <div><p className="text-2xl font-semibold text-violet-600">{s.converted}</p><p className="text-[11px] text-gray-400 uppercase tracking-wide">Converted</p></div>
            </div>
            <div className="flex gap-6 pt-4 border-t border-gray-50">
              <div><p className="text-[15px] font-semibold text-gray-800">{s.replyRate}%</p><p className="text-[10px] text-gray-400">Reply rate</p></div>
              <div><p className="text-[15px] font-semibold text-gray-800">{s.conversionRate}%</p><p className="text-[10px] text-gray-400">Conversion</p></div>
              <div className="ml-auto text-right"><p className="text-[10px] text-gray-400">Last active</p><p className="text-[12px] text-gray-500">{s.lastActivity ? new Date(s.lastActivity).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "Never"}</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
