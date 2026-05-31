"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AvatarChip from "@/components/AvatarChip";

const ACTION_LABELS: Record<string, string> = {
  CREATED: "created prospect",
  ASSIGNED: "assigned prospect",
  SENT_WHATSAPP: "sent WhatsApp to",
  SENT_INSTAGRAM: "sent Instagram DM to",
  FOLLOW_UP: "sent follow-up to",
  MARKED_REPLIED: "marked as replied",
  MARKED_NO_WHATSAPP: "marked as no WhatsApp",
  STATUS_ENVOYE: "changed status to Envoyé for",
  STATUS_REPONDU: "marked as replied",
  STATUS_A_ENVOYER: "reset to À envoyer",
  STATUS_CONVERTI: "converted to lead",
  STATUS_PAS_DE_WHATSAPP: "marked as no WhatsApp",
  NOTE_ADDED: "added a note to",
  UPDATED: "updated",
};

type Activity = {
  id: string;
  userId: string;
  userName: string;
  actionType: string;
  previousStatus: string | null;
  newStatus: string | null;
  details: string | null;
  createdAt: string;
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
    fetch("/api/admin/users")
      .then((r) => r.ok ? r.json() : [])
      .then(setTeamUsers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = filterUser !== "ALL" ? `?userId=${filterUser}&limit=100` : "?limit=100";
    fetch(`/api/admin/activity${qs}`)
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setActivities(data);
        setLoading(false);
      });
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
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-100">Activity Feed</h1>
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="px-3 py-1.5 bg-[#1a1a2e] border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-violet-500"
        >
          <option value="ALL">All team members</option>
          {teamUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-gray-500 animate-pulse">Loading...</div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No activity yet.</div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{date}</h3>
              <div className="space-y-0 border-l-2 border-white/10 ml-3">
                {items.map((a) => {
                  const user = teamUsers.find((u) => u.id === a.userId);
                  return (
                    <div key={a.id} className="relative pl-6 pb-4">
                      <div className="absolute -left-[5px] top-2 w-2 h-2 rounded-full bg-violet-500" />
                      <div className="flex items-start gap-3">
                        {user && (
                          <AvatarChip initials={user.avatarInitials} name={user.fullName} showName={false} size="sm" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-300">
                            <span className="font-medium text-gray-200">{a.userName}</span>
                            {" "}
                            {ACTION_LABELS[a.actionType] ?? a.actionType}
                            {" "}
                            <Link
                              href={`/admin/prospecting/${a.prospect.id}`}
                              className="text-violet-400 hover:text-violet-300"
                            >
                              {a.prospect.name}
                            </Link>
                          </p>
                          {a.details && a.actionType === "NOTE_ADDED" && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">&ldquo;{a.details}&rdquo;</p>
                          )}
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            {new Date(a.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
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
