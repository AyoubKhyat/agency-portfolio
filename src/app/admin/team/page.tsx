"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AvatarChip from "@/components/AvatarChip";
import { HiOutlinePlus } from "react-icons/hi2";

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
  contacted: number;
  replied: number;
  converted: number;
  replyRate: number;
  conversionRate: number;
  lastActivity: string | null;
  lastActionType: string | null;
};

const ROLES = ["admin", "sales", "designer", "developer"];
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-violet-500/20 text-violet-400",
  sales: "bg-blue-500/20 text-blue-400",
  designer: "bg-pink-500/20 text-pink-400",
  developer: "bg-green-500/20 text-green-400",
};

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
      fetch("/api/admin/team-stats").then((r) => r.ok ? r.json() : []),
    ]).then(([usersData, statsData]) => {
      if (usersData) setUsers(usersData);
      if (statsData) setStats(statsData);
      setLoading(false);
    });
  }, [router]);

  async function handleToggleActive(user: User) {
    const action = user.isActive ? "deactivate" : "activate";
    if (!confirm(`${action} ${user.fullName}?`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    const initials = formData.avatarInitials || formData.fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

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

  if (loading) return <div className="text-gray-500 animate-pulse">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-100">Team</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <HiOutlinePlus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Add user form */}
      {showForm && (
        <form onSubmit={handleCreateUser} className="border border-white/10 rounded-xl p-6 mb-8 space-y-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">New Team Member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Full Name</label>
              <input
                value={formData.fullName}
                onChange={(e) => setFormData((d) => ({ ...d, fullName: e.target.value }))}
                required
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                required
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((d) => ({ ...d, password: e.target.value }))}
                required
                minLength={6}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData((d) => ({ ...d, role: e.target.value }))}
                className="w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-violet-500"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-white/10 text-gray-400 rounded-lg text-sm hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Team members */}
      <div className="border border-white/10 rounded-xl overflow-hidden mb-10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Member</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Role</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3">
                  <AvatarChip initials={user.avatarInitials} name={user.fullName} size="sm" />
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ROLE_COLORS[user.role] ?? "bg-gray-500/20 text-gray-400"}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleActive(user)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      user.isActive
                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                        : "bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20"
                    }`}
                  >
                    {user.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Team Performance */}
      <h2 className="text-xl font-semibold text-gray-100 mb-6">Team Performance</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.user.id} className="border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <AvatarChip initials={s.user.avatarInitials} name={s.user.fullName} size="md" />
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ROLE_COLORS[s.user.role] ?? ""}`}>
                {s.user.role}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-semibold text-gray-100">{s.assigned}</p>
                <p className="text-[10px] text-gray-500 uppercase">Assigned</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-100">{s.contacted}</p>
                <p className="text-[10px] text-gray-500 uppercase">Contacted</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-green-400">{s.replied}</p>
                <p className="text-[10px] text-gray-500 uppercase">Replies</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-violet-400">{s.converted}</p>
                <p className="text-[10px] text-gray-500 uppercase">Converted</p>
              </div>
            </div>
            <div className="flex gap-4 mt-4 pt-3 border-t border-white/5">
              <div>
                <p className="text-sm font-medium text-gray-200">{s.replyRate}%</p>
                <p className="text-[10px] text-gray-500">Reply rate</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-200">{s.conversionRate}%</p>
                <p className="text-[10px] text-gray-500">Conversion</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-[10px] text-gray-500">Last active</p>
                <p className="text-xs text-gray-400">
                  {s.lastActivity
                    ? new Date(s.lastActivity).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
                    : "Never"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
