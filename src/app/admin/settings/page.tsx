"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { GlassCard } from "@/components/admin/glass-card";
import { FormButton } from "@/components/admin/form";
import {
  User, Lock, Shield, CheckCircle, AlertCircle, Eye, EyeOff, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Me = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  avatarInitials: string;
};

type TeamUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarInitials: string;
  isActive: boolean;
  createdAt: string;
};

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4",
      type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200",
    )}>
      {type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {message}
    </div>
  );
}

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [fullName, setFullName] = useState("");
  const [initials, setInitials] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const flash = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/me").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ]).then(([meData, usersData]) => {
      setMe(meData);
      setFullName(meData.fullName);
      setInitials(meData.avatarInitials);
      setTeam(Array.isArray(usersData) ? usersData : []);
      setLoading(false);
    });
  }, []);

  async function saveProfile() {
    if (!me || !fullName.trim() || !initials.trim()) return;
    setProfileSaving(true);
    const res = await fetch(`/api/admin/users/${me.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: fullName.trim(), avatarInitials: initials.trim().toUpperCase() }),
    });
    if (res.ok) {
      flash("Profile updated", "success");
      const updated = await res.json();
      setMe((prev) => prev ? { ...prev, fullName: updated.fullName, avatarInitials: updated.avatarInitials } : prev);
    } else {
      flash("Failed to update profile", "error");
    }
    setProfileSaving(false);
  }

  async function changePassword() {
    if (!me || !currentPassword || !newPassword) return;
    if (newPassword.length < 6) {
      flash("Password must be at least 6 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      flash("Passwords do not match", "error");
      return;
    }
    setPasswordSaving(true);
    const verifyRes = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: me.email, password: currentPassword }),
    });
    if (!verifyRes.ok) {
      flash("Current password is incorrect", "error");
      setPasswordSaving(false);
      return;
    }
    const res = await fetch(`/api/admin/users/${me.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    if (res.ok) {
      flash("Password changed successfully", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      flash("Failed to change password", "error");
    }
    setPasswordSaving(false);
  }

  async function toggleUserActive(user: TeamUser) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (res.ok) {
      setTeam((prev) => prev.map((u) => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
      flash(`${user.fullName} ${user.isActive ? "deactivated" : "activated"}`, "success");
    }
  }

  async function changeUserRole(userId: string, role: string) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setTeam((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
      flash("Role updated", "success");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  const isAdmin = me?.role === "admin";

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" subtitle="Manage your account and team" />

      {/* Profile Section */}
      <GlassCard padding="lg" className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">Profile</h2>
            <p className="text-xs text-[#475569]">Update your name and avatar</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-[#0F172A] focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1.5">Initials</label>
            <input
              type="text"
              value={initials}
              onChange={(e) => setInitials(e.target.value.slice(0, 3))}
              maxLength={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-[#0F172A] focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#94A3B8] mb-4">
          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 font-medium capitalize">{me?.role}</span>
          <span>{me?.email}</span>
        </div>

        <FormButton onClick={saveProfile} disabled={profileSaving || !fullName.trim()}>
          {profileSaving ? "Saving..." : "Save Profile"}
        </FormButton>
      </GlassCard>

      {/* Password Section */}
      <GlassCard padding="lg" className="max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">Change Password</h2>
            <p className="text-xs text-[#475569]">Update your login credentials</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 text-sm text-[#0F172A] focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569]"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">New Password</label>
              <input
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-[#0F172A] focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">Confirm Password</label>
              <input
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-sm text-[#0F172A] focus:ring-2 focus:ring-purple-200 outline-none transition-all",
                  confirmPassword && confirmPassword !== newPassword ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-purple-400",
                )}
              />
            </div>
          </div>
          {newPassword && newPassword.length < 6 && (
            <p className="text-xs text-amber-600">Password must be at least 6 characters</p>
          )}
        </div>

        <FormButton
          onClick={changePassword}
          disabled={passwordSaving || !currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
        >
          {passwordSaving ? "Changing..." : "Change Password"}
        </FormButton>
      </GlassCard>

      {/* Team Management (Admin only) */}
      {isAdmin && (
        <GlassCard padding="lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">Team Management</h2>
              <p className="text-xs text-[#475569]">Manage roles and access for your team</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-2 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Member</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Email</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Role</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.map((user) => (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                          user.isActive ? "bg-gradient-to-br from-purple-500 to-violet-600" : "bg-gray-300",
                        )}>
                          {user.avatarInitials}
                        </div>
                        <span className="font-medium text-[#0F172A]">{user.fullName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-[#475569]">{user.email}</td>
                    <td className="py-3 px-2">
                      <select
                        value={user.role}
                        onChange={(e) => changeUserRole(user.id, e.target.value)}
                        disabled={user.id === me?.userId}
                        className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-white text-[#0F172A] disabled:opacity-50"
                      >
                        <option value="admin">Admin</option>
                        <option value="sales">Sales</option>
                        <option value="developer">Developer</option>
                        <option value="designer">Designer</option>
                      </select>
                    </td>
                    <td className="py-3 px-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        user.isActive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600",
                      )}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      {user.id !== me?.userId && (
                        <button
                          onClick={() => toggleUserActive(user)}
                          className={cn(
                            "text-xs px-3 py-1 rounded-md font-medium transition-colors",
                            user.isActive
                              ? "text-red-600 hover:bg-red-50"
                              : "text-emerald-600 hover:bg-emerald-50",
                          )}
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
