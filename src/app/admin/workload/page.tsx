"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  HiOutlineClipboardDocumentList,
  HiOutlineCalendarDays,
  HiOutlineUserGroup,
  HiOutlineArrowPath,
} from "react-icons/hi2";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { GlassCard } from "@/components/admin/glass-card";
import { Badge } from "@/components/admin/badge";
import { EmptyState } from "@/components/admin/empty-state";
import AvatarChip from "@/components/AvatarChip";

type WorkloadMember = {
  user: {
    id: string;
    fullName: string;
    avatarInitials: string;
    role: string;
  };
  tasks: {
    todo: number;
    inProgress: number;
    review: number;
    blocked: number;
    done: number;
    active: number;
  };
  openProspects: number;
  meetingsThisWeek: number;
  totalActiveItems: number;
};

function getLoadLevel(total: number): { label: string; color: string; barColor: string; badgeVariant: "green" | "amber" | "red" } {
  if (total <= 5) return { label: "Available", color: "text-emerald-600", barColor: "bg-emerald-500", badgeVariant: "green" };
  if (total <= 10) return { label: "Busy", color: "text-amber-600", barColor: "bg-amber-500", badgeVariant: "amber" };
  return { label: "Overloaded", color: "text-red-600", barColor: "bg-red-500", badgeVariant: "red" };
}

export default function WorkloadPage() {
  const router = useRouter();
  const [members, setMembers] = useState<WorkloadMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/workload")
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setMembers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-purple-300 border-t-[#8B00FF] rounded-full animate-spin" />
      </div>
    );
  }

  const totalActive = members.reduce((s, m) => s + m.tasks.active, 0);
  const totalProspects = members.reduce((s, m) => s + m.openProspects, 0);
  const totalMeetings = members.reduce((s, m) => s + m.meetingsThisWeek, 0);
  const maxLoad = Math.max(...members.map((m) => m.totalActiveItems), 1);

  // Rebalance suggestions
  const overloaded = members.filter((m) => m.totalActiveItems > 10);
  const available = members.filter((m) => m.totalActiveItems <= 5);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Workload"
        subtitle="Team capacity planning and load distribution"
        count={members.length}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard value={members.length} label="Active Members" icon={<HiOutlineUserGroup className="w-5 h-5" />} index={0} />
        <StatCard value={totalActive} label="Active Tasks" icon={<HiOutlineClipboardDocumentList className="w-5 h-5" />} index={1} />
        <StatCard value={totalProspects} label="Open Prospects" icon={<HiOutlineArrowPath className="w-5 h-5" />} index={2} />
        <StatCard value={totalMeetings} label="Meetings This Week" icon={<HiOutlineCalendarDays className="w-5 h-5" />} index={3} accent />
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={<HiOutlineUserGroup className="w-7 h-7" />}
          title="No active team members"
          description="Add team members to start tracking workload and capacity."
          action={
            <Link
              href="/admin/team"
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white rounded-xl text-[13px] font-medium shadow-sm shadow-purple-200 hover:shadow-md hover:shadow-purple-300 transition-all"
            >
              Go to Team
            </Link>
          }
        />
      ) : (
        <>
          {/* Capacity Cards */}
          <div className="mb-8">
            <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Capacity Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {members.map((m, i) => {
                const load = getLoadLevel(m.totalActiveItems);
                const barPercent = Math.round((m.totalActiveItems / maxLoad) * 100);

                return (
                  <GlassCard
                    key={m.user.id}
                    hover
                    glow
                    padding="none"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <div className="p-5 pb-0">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarChip initials={m.user.avatarInitials} name={m.user.fullName} size="md" showName={false} />
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-[#0F172A] truncate">{m.user.fullName}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge variant={m.user.role === "admin" ? "purple" : m.user.role === "sales" ? "blue" : m.user.role === "designer" ? "red" : "green"} size="sm">
                                {m.user.role.charAt(0).toUpperCase() + m.user.role.slice(1)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Badge variant={load.badgeVariant} size="sm" dot>
                          {load.label}
                        </Badge>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-x-4 gap-y-3 mb-4">
                        <div>
                          <p className="text-xl font-bold text-[#0F172A]">{m.tasks.active}</p>
                          <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mt-0.5">Active Tasks</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-blue-600">{m.openProspects}</p>
                          <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mt-0.5">Prospects</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-[#8B00FF]">{m.meetingsThisWeek}</p>
                          <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mt-0.5">Meetings</p>
                        </div>
                      </div>

                      {/* Load bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-medium text-[#475569]">Load Level</span>
                          <span className="text-[11px] font-semibold text-[#0F172A]">{m.totalActiveItems} items</span>
                        </div>
                        <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${load.barColor}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(barPercent, 100)}%` }}
                            transition={{ duration: 0.8, delay: i * 0.06 + 0.3, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer actions */}
                    <div className="border-t border-[#F1F5F9] px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[12px] text-[#64748B]">
                        <span>{m.tasks.todo} TODO</span>
                        <span className="text-[#CBD5E1]">|</span>
                        <span>{m.tasks.inProgress} In Progress</span>
                        <span className="text-[#CBD5E1]">|</span>
                        <span>{m.tasks.review} Review</span>
                      </div>
                      <Link
                        href={`/admin/tasks?owner=${m.user.id}`}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-medium text-[#8B00FF] bg-purple-50 hover:bg-purple-100 transition-all"
                      >
                        View Tasks
                      </Link>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </div>

          {/* Workload Distribution Chart */}
          <div className="mb-8">
            <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Workload Distribution</h2>
            <GlassCard padding="lg">
              <div className="space-y-4">
                {members
                  .sort((a, b) => b.totalActiveItems - a.totalActiveItems)
                  .map((m, i) => {
                    const load = getLoadLevel(m.totalActiveItems);
                    const barPercent = maxLoad > 0 ? Math.round((m.totalActiveItems / maxLoad) * 100) : 0;

                    return (
                      <motion.div
                        key={m.user.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.08 }}
                      >
                        <div className="flex items-center gap-3 mb-1.5">
                          <div className="w-28 sm:w-36 flex items-center gap-2 shrink-0">
                            <AvatarChip initials={m.user.avatarInitials} name={m.user.fullName} size="xs" showName={false} />
                            <span className="text-[13px] font-medium text-[#0F172A] truncate">{m.user.fullName}</span>
                          </div>
                          <div className="flex-1 flex items-center gap-3">
                            <div className="flex-1 h-6 bg-[#F1F5F9] rounded-lg overflow-hidden relative">
                              <motion.div
                                className={`h-full rounded-lg ${load.barColor} flex items-center justify-end pr-2`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(barPercent, 8)}%` }}
                                transition={{ duration: 0.8, delay: i * 0.08 + 0.2, ease: "easeOut" }}
                              >
                                {barPercent > 15 && (
                                  <span className="text-[10px] font-bold text-white">{m.totalActiveItems}</span>
                                )}
                              </motion.div>
                              {barPercent <= 15 && (
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#475569]">
                                  {m.totalActiveItems}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#64748B]">
                                <span className="w-2 h-2 rounded-full bg-[#475569]" /> {m.tasks.active}T
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#64748B]">
                                <span className="w-2 h-2 rounded-full bg-blue-500" /> {m.openProspects}P
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#64748B]">
                                <span className="w-2 h-2 rounded-full bg-[#8B00FF]" /> {m.meetingsThisWeek}M
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
              <div className="flex items-center gap-4 mt-5 pt-4 border-t border-[#F1F5F9]">
                <span className="text-[11px] text-[#94A3B8] font-medium">Legend:</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#64748B]">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available (&le;5)
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#64748B]">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Busy (6-10)
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#64748B]">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Overloaded (&gt;10)
                </span>
              </div>
            </GlassCard>
          </div>

          {/* Task Distribution Table */}
          <div className="mb-8">
            <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Task Distribution</h2>
            <GlassCard padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#F1F5F9]">
                      <th className="text-left text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider px-5 py-3">Team Member</th>
                      <th className="text-center text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider px-3 py-3">TODO</th>
                      <th className="text-center text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider px-3 py-3">In Progress</th>
                      <th className="text-center text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider px-3 py-3">Review</th>
                      <th className="text-center text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider px-3 py-3">Blocked</th>
                      <th className="text-center text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider px-3 py-3">Done</th>
                      <th className="text-center text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider px-3 py-3">Total Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const maxTodo = Math.max(...members.map((m) => m.tasks.todo));
                      return members
                        .sort((a, b) => b.tasks.active - a.tasks.active)
                        .map((m) => {
                          const highlightTodo = m.tasks.todo === maxTodo && maxTodo > 0;
                          return (
                            <tr key={m.user.id} className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC]/60 transition-colors">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2.5">
                                  <AvatarChip initials={m.user.avatarInitials} name={m.user.fullName} size="sm" showName={false} />
                                  <div>
                                    <p className="font-medium text-[#0F172A]">{m.user.fullName}</p>
                                    <p className="text-[11px] text-[#94A3B8] capitalize">{m.user.role}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="text-center px-3 py-3">
                                <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-lg text-[12px] font-semibold ${highlightTodo ? "bg-red-100 text-red-700" : "text-[#475569]"}`}>
                                  {m.tasks.todo}
                                </span>
                              </td>
                              <td className="text-center px-3 py-3">
                                <span className="text-[12px] font-semibold text-blue-600">{m.tasks.inProgress}</span>
                              </td>
                              <td className="text-center px-3 py-3">
                                <span className="text-[12px] font-semibold text-amber-600">{m.tasks.review}</span>
                              </td>
                              <td className="text-center px-3 py-3">
                                <span className={`text-[12px] font-semibold ${m.tasks.blocked > 0 ? "text-red-600" : "text-[#475569]"}`}>{m.tasks.blocked}</span>
                              </td>
                              <td className="text-center px-3 py-3">
                                <span className="text-[12px] font-semibold text-emerald-600">{m.tasks.done}</span>
                              </td>
                              <td className="text-center px-3 py-3">
                                <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-lg text-[12px] font-bold bg-[#F1F5F9] text-[#0F172A]">
                                  {m.tasks.active}
                                </span>
                              </td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>

          {/* Rebalance Suggestions */}
          {(overloaded.length > 0 || available.length > 0) && (
            <div className="mb-8">
              <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Rebalance Suggestions</h2>
              <GlassCard padding="lg">
                {overloaded.length > 0 && available.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-100 text-amber-600 shrink-0 mt-0.5">
                        <HiOutlineArrowPath className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-[#0F172A] mb-1">Redistribution recommended</p>
                        <p className="text-[13px] text-[#64748B] mb-3">
                          {overloaded.length} team member{overloaded.length > 1 ? "s" : ""} overloaded, {available.length} member{available.length > 1 ? "s" : ""} with spare capacity.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
                        <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider mb-3">Overloaded</p>
                        <div className="space-y-2.5">
                          {overloaded.map((m) => (
                            <div key={m.user.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AvatarChip initials={m.user.avatarInitials} name={m.user.fullName} size="xs" showName={false} />
                                <span className="text-[13px] font-medium text-[#0F172A]">{m.user.fullName}</span>
                              </div>
                              <span className="text-[12px] font-bold text-red-600">{m.totalActiveItems} items</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                        <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mb-3">Available Capacity</p>
                        <div className="space-y-2.5">
                          {available.map((m) => (
                            <div key={m.user.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AvatarChip initials={m.user.avatarInitials} name={m.user.fullName} size="xs" showName={false} />
                                <span className="text-[13px] font-medium text-[#0F172A]">{m.user.fullName}</span>
                              </div>
                              <span className="text-[12px] font-bold text-emerald-600">{m.totalActiveItems} items</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : overloaded.length > 0 ? (
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-red-100 text-red-600 shrink-0 mt-0.5">
                      <HiOutlineArrowPath className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[#0F172A] mb-1">Team at capacity</p>
                      <p className="text-[13px] text-[#64748B]">
                        {overloaded.length} member{overloaded.length > 1 ? "s are" : " is"} overloaded but no one has spare capacity. Consider deferring non-urgent tasks or bringing in help.
                      </p>
                      <div className="mt-3 space-y-2">
                        {overloaded.map((m) => (
                          <div key={m.user.id} className="flex items-center gap-2">
                            <AvatarChip initials={m.user.avatarInitials} name={m.user.fullName} size="xs" showName />
                            <span className="text-[12px] font-bold text-red-600">({m.totalActiveItems} items)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 shrink-0 mt-0.5">
                      <HiOutlineArrowPath className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[#0F172A] mb-1">Team has capacity</p>
                      <p className="text-[13px] text-[#64748B]">
                        All team members are within normal load levels. {available.length} member{available.length > 1 ? "s have" : " has"} spare capacity for new work.
                      </p>
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}
