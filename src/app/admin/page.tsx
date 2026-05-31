"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  HiOutlineMegaphone,
  HiOutlineInbox,
  HiOutlineFolder,
  HiOutlineEye,
  HiOutlineChatBubbleLeft,
  HiOutlineCheckCircle,
} from "react-icons/hi2";

type Stats = {
  totalProjects: number;
  visibleProjects: number;
  totalLeads: number;
  newLeads: number;
  totalProspects: number;
  pendingProspects: number;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/projects").then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        return r.json();
      }),
      fetch("/api/admin/leads").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/leads?status=NEW").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/prospecting").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/prospecting?status=A_ENVOYER").then((r) => r.ok ? r.json() : null),
    ]).then(([projects, leads, newLeads, prospects, pendingProspects]) => {
      if (!projects) return;
      setStats({
        totalProjects: projects.length,
        visibleProjects: projects.filter((p: { visible: boolean }) => p.visible).length,
        totalLeads: leads?.total ?? 0,
        newLeads: newLeads?.total ?? 0,
        totalProspects: prospects?.total ?? 0,
        pendingProspects: pendingProspects?.total ?? 0,
      });
    });
  }, [router]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  const cards = [
    { label: "Total Prospects", value: stats.totalProspects, icon: HiOutlineMegaphone, href: "/admin/prospecting", gradient: "from-violet-500 to-purple-600", shadow: "shadow-violet-100" },
    { label: "Pending", value: stats.pendingProspects, icon: HiOutlineChatBubbleLeft, href: "/admin/prospecting?status=A_ENVOYER", gradient: "from-blue-500 to-cyan-500", shadow: "shadow-blue-100" },
    { label: "New Leads", value: stats.newLeads, icon: HiOutlineCheckCircle, href: "/admin/leads?status=NEW", gradient: "from-emerald-500 to-teal-500", shadow: "shadow-emerald-100" },
    { label: "Total Leads", value: stats.totalLeads, icon: HiOutlineInbox, href: "/admin/leads" },
    { label: "Projects", value: stats.totalProjects, icon: HiOutlineFolder, href: "/admin/projects" },
    { label: "Live", value: stats.visibleProjects, icon: HiOutlineEye, href: "/admin/projects" },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-400 mt-1">Your workspace at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group relative overflow-hidden p-6 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 transition-all duration-200 hover:shadow-lg hover:shadow-gray-100/50"
          >
            {card.gradient && (
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.gradient} opacity-[0.07] rounded-full -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500`} />
            )}
            <div className="relative">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${card.gradient ? `bg-gradient-to-br ${card.gradient} ${card.shadow} shadow-sm` : "bg-gray-100"}`}>
                <card.icon className={`w-5 h-5 ${card.gradient ? "text-white" : "text-gray-500"}`} />
              </div>
              <p className="text-3xl font-semibold text-gray-900">{card.value}</p>
              <p className="text-[13px] text-gray-400 mt-1">{card.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
