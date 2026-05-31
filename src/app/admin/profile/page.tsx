"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AvatarChip from "@/components/AvatarChip";

const ACTION_LABELS: Record<string, string> = {
  CREATED: "created prospect", ASSIGNED: "assigned prospect", SENT_WHATSAPP: "sent WhatsApp to", SENT_INSTAGRAM: "sent Instagram DM to",
  FOLLOW_UP: "sent follow-up to", MARKED_REPLIED: "marked as replied", MARKED_NO_WHATSAPP: "marked no WhatsApp",
  STATUS_ENVOYE: "changed status to Sent", STATUS_REPONDU: "marked as replied", STATUS_CONVERTI: "converted to lead",
  NOTE_ADDED: "added a note to", UPDATED: "updated",
};
const ROLE_COLORS: Record<string, string> = { admin: "bg-violet-50 text-violet-600", sales: "bg-blue-50 text-blue-600", designer: "bg-pink-50 text-pink-600", developer: "bg-emerald-50 text-emerald-600" };

type SessionUser = { userId: string; email: string; fullName: string; role: string; avatarInitials: string };
type Activity = { id: string; userName: string; actionType: string; details: string | null; createdAt: string; prospect: { id: string; name: string; sector: string } };
type TeamStat = { user: { id: string; fullName: string; avatarInitials: string; role: string }; assigned: number; sent: number; contacted: number; replied: number; converted: number; replyRate: number; conversionRate: number; lastActivity: string | null };

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [myStat, setMyStat] = useState<TeamStat | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingFollowups, setPendingFollowups] = useState(0);

  useEffect(() => {
    fetch("/api/admin/me").then((r) => { if (!r.ok) { router.push("/admin/login"); return null; } return r.json(); })
      .then((user) => {
        if (!user) return;
        setMe(user);
        Promise.all([
          fetch("/api/admin/team-stats").then((r) => r.ok ? r.json() : []),
          fetch(`/api/admin/activity?userId=${user.userId}&limit=30`).then((r) => r.ok ? r.json() : []),
          fetch(`/api/admin/prospecting?owner=${user.userId}&status=ENVOYE`).then((r) => r.ok ? r.json() : null),
        ]).then(([stats, acts, envoye]) => {
          const mine = stats.find((s: TeamStat) => s.user.id === user.userId);
          if (mine) setMyStat(mine);
          setActivities(acts);
          if (envoye) {
            const count = envoye.prospects.filter((p: { sentAt: string }) => p.sentAt && (Date.now() - new Date(p.sentAt).getTime()) > 3 * 86400000).length;
            setPendingFollowups(count);
          }
          setLoading(false);
        });
      });
  }, [router]);

  if (loading || !me) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" /></div>;

  const cards = [
    { label: "Assigned to me", value: myStat?.assigned ?? 0, color: "text-[#0F172A]" },
    { label: "Sent by me", value: myStat?.sent ?? 0, color: "text-blue-600" },
    { label: "Replies", value: myStat?.replied ?? 0, color: "text-emerald-600" },
    { label: "Converted", value: myStat?.converted ?? 0, color: "text-violet-600" },
    { label: "Follow-ups pending", value: pendingFollowups, color: "text-amber-600" },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-lg sm:text-xl font-semibold text-white shadow-lg shadow-violet-100 shrink-0">
              {me.avatarInitials}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-[#0F172A]">{me.fullName}</h1>
              <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase ${ROLE_COLORS[me.role] ?? ""}`}>{me.role}</span>
                <span className="text-[12px] sm:text-[13px] text-[#64748B] truncate">{me.email}</span>
              </div>
            </div>
          </div>
          <div className="sm:ml-auto flex gap-4 sm:gap-4 pl-16 sm:pl-0">
            <div className="text-center sm:text-right">
              <p className="text-lg sm:text-xl font-semibold text-[#0F172A]">{myStat?.replyRate ?? 0}%</p>
              <p className="text-[10px] text-[#64748B] uppercase">Reply rate</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-lg sm:text-xl font-semibold text-[#0F172A]">{myStat?.conversionRate ?? 0}%</p>
              <p className="text-[10px] text-[#64748B] uppercase">Conversion</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-4 sm:mb-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 text-center">
            <p className={`text-xl sm:text-2xl font-semibold ${c.color}`}>{c.value}</p>
            <p className="text-[10px] text-[#64748B] mt-1 uppercase tracking-wide">{c.label}</p>
          </div>
        ))}
      </div>

      {/* My Activity */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
        <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4 sm:mb-5">My Activity</h2>
        {activities.length === 0 ? (
          <p className="text-[13px] text-[#64748B] py-8 text-center">No activity yet. Start prospecting!</p>
        ) : (
          <div className="space-y-0 border-l-2 border-gray-100 ml-2">
            {activities.map((a) => (
              <div key={a.id} className="relative pl-5 pb-4">
                <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-violet-400" />
                <p className="text-[13px] text-gray-600">
                  {ACTION_LABELS[a.actionType] ?? a.actionType}{" "}
                  <Link href={`/admin/prospecting/${a.prospect.id}`} className="font-medium text-violet-600 hover:text-violet-700">{a.prospect.name}</Link>
                </p>
                {a.details && a.actionType === "NOTE_ADDED" && <p className="text-[11px] text-[#64748B] mt-0.5 truncate">&ldquo;{a.details}&rdquo;</p>}
                <p className="text-[10px] text-[#64748B] mt-0.5">{new Date(a.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
