"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AvatarChip from "@/components/AvatarChip";

const ACTION_LABELS: Record<string, string> = {
  CREATED: "created prospect", ASSIGNED: "assigned prospect", SENT_WHATSAPP: "sent WhatsApp to", SENT_INSTAGRAM: "sent Instagram DM to",
  FOLLOW_UP: "sent follow-up to", MARKED_REPLIED: "marked as replied", MARKED_NO_WHATSAPP: "marked as no WhatsApp",
  STATUS_ENVOYE: "changed status to Sent for", STATUS_REPONDU: "marked as replied", STATUS_A_ENVOYER: "reset to To Send",
  STATUS_CONVERTI: "converted to lead", STATUS_PAS_DE_WHATSAPP: "marked no WhatsApp", NOTE_ADDED: "added a note to", UPDATED: "updated",
};

type Activity = {
  id: string; userId: string; userName: string; actionType: string; previousStatus: string | null;
  newStatus: string | null; details: string | null; createdAt: string;
  prospect: { id: string; name: string; sector: string };
};
type TeamUser = { id: string; fullName: string; avatarInitials: string };

export default function ActivityPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [filterUser, setFilterUser] = useState("ALL");

  useEffect(() => {
    fetch("/api/admin/users").then((r) => r.ok ? r.json() : []).then(setTeamUsers).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = filterUser !== "ALL" ? `?userId=${filterUser}&limit=100` : "?limit=100";
    fetch(`/api/admin/activity${qs}`).then((r) => {
      if (r.status === 401) { router.push("/admin/login"); return null; }
      return r.json();
    }).then((data) => { if (data) setActivities(data); setLoading(false); });
  }, [filterUser, router]);

  function groupByDate(items: Activity[]) {
    const groups: Record<string, Activity[]> = {};
    for (const item of items) {
      const date = new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    }
    return groups;
  }

  const grouped = groupByDate(activities);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Activity Feed</h1>
          <p className="text-sm text-gray-400 mt-0.5">Team actions in real time</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => setFilterUser("ALL")} className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all ${filterUser === "ALL" ? "bg-gray-900 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"}`}>
            All
          </button>
          {teamUsers.map((u) => (
            <AvatarChip key={u.id} initials={u.avatarInitials} name={u.fullName} showName={false} size="sm" onClick={() => setFilterUser(u.id)} active={filterUser === u.id} />
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" /></div>
      ) : activities.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">No activity yet.</div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">{date}</h3>
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {items.map((a) => {
                  const user = teamUsers.find((u) => u.id === a.userId);
                  return (
                    <div key={a.id} className="flex items-start gap-3 px-5 py-4">
                      {user && <AvatarChip initials={user.avatarInitials} name={user.fullName} showName={false} size="sm" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-gray-600">
                          <span className="font-medium text-gray-800">{a.userName}</span>{" "}
                          {ACTION_LABELS[a.actionType] ?? a.actionType}{" "}
                          <Link href={`/admin/prospecting/${a.prospect.id}`} className="font-medium text-violet-600 hover:text-violet-700">{a.prospect.name}</Link>
                        </p>
                        {a.details && a.actionType === "NOTE_ADDED" && <p className="text-[11px] text-gray-400 mt-0.5 truncate">&ldquo;{a.details}&rdquo;</p>}
                      </div>
                      <p className="text-[11px] text-gray-400 shrink-0">{new Date(a.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
