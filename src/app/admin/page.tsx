"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HiOutlineFolder, HiOutlineInbox, HiOutlineEye, HiOutlineEnvelope, HiOutlineMegaphone, HiOutlineChatBubbleLeft } from "react-icons/hi2";

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
    return <div className="text-gray-500 animate-pulse">Loading...</div>;
  }

  const cards = [
    { label: "Total Projects", value: stats.totalProjects, icon: HiOutlineFolder, href: "/admin/projects" },
    { label: "Visible Projects", value: stats.visibleProjects, icon: HiOutlineEye, href: "/admin/projects" },
    { label: "Total Leads", value: stats.totalLeads, icon: HiOutlineInbox, href: "/admin/leads" },
    { label: "New Leads", value: stats.newLeads, icon: HiOutlineEnvelope, href: "/admin/leads?status=NEW", accent: true },
    { label: "Total Prospects", value: stats.totalProspects, icon: HiOutlineMegaphone, href: "/admin/prospecting" },
    { label: "A envoyer", value: stats.pendingProspects, icon: HiOutlineChatBubbleLeft, href: "/admin/prospecting?status=A_ENVOYER", accent: true },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-100 mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`p-6 rounded-xl border transition-colors ${
              card.accent
                ? "border-violet-500/30 bg-violet-500/10 hover:border-violet-500/50"
                : "border-white/10 bg-white/5 hover:border-white/20"
            }`}
          >
            <card.icon className={`w-6 h-6 mb-3 ${card.accent ? "text-violet-400" : "text-gray-500"}`} />
            <p className="text-3xl font-semibold text-gray-100">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
