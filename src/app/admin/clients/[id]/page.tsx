"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, ExternalLink, MessageCircle, Phone, Mail, Globe,
  Briefcase, FileText, StickyNote, CalendarDays, FolderOpen, Activity,
  Building2, User, DollarSign, Tag, Loader2, Send, Edit2, Save, X,
  Trash2, Plus, Calendar as CalendarIcon, FileSignature, Video, MapPin,
  CheckCircle2, AlertCircle, History, CircleDot, ShieldCheck,
} from "lucide-react";
import { ScheduleMeetingModal } from "@/components/admin/schedule-meeting-modal";
import { FaWhatsapp } from "react-icons/fa";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TaskList } from "@/components/admin/task-list";
import { MentionTextarea, HighlightedMentions } from "@/components/admin/mention-textarea";

type Client = {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  industry: string;
  contractValue: number;
  acquisitionSource: string;
  status: string;
  accountManagerId: string | null;
  prospectId: string | null;
  createdAt: string;
  updatedAt: string;
  accountManager: { id: string; fullName: string; avatarInitials: string; role: string } | null;
  prospect: { id: string; name: string; sector: string; status: string } | null;
  projects: ClientProject[];
  proposals: Proposal[];
  notes: ClientNote[];
  activities: ClientActivity[];
};

type ClientProject = {
  id: string; name: string; description: string; status: string;
  priority: string; budget: number; amountPaid: number; currency: string;
  progress: number; dueDate: string | null; updatedAt: string;
};
type Proposal = {
  id: string; packageName: string | null; status: string; amount: number;
  currency: string; contactPerson: string; createdAt: string; sentAt: string | null;
};
type ClientNote = {
  id: string; content: string; authorName: string | null; createdAt: string;
};
type ClientActivity = {
  id: string; userName: string | null; actionType: string; details: string | null; createdAt: string;
};
type TeamMember = { id: string; fullName: string; avatarInitials: string };

const STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   "bg-emerald-50 text-emerald-700 border-emerald-100",
  PAUSED:   "bg-amber-50 text-amber-700 border-amber-100",
  ARCHIVED: "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]",
};
const STATUS_DOTS: Record<string, string> = {
  ACTIVE: "bg-emerald-500", PAUSED: "bg-amber-500", ARCHIVED: "bg-[#9CA3AF]",
};

const PROPOSAL_STATUS_COLOR: Record<string, string> = {
  DRAFT:    "text-[#6B7280] bg-[#F3F4F6] border-[#E5E7EB]",
  SENT:     "text-blue-700 bg-blue-50 border-blue-100",
  ACCEPTED: "text-emerald-700 bg-emerald-50 border-emerald-100",
  REJECTED: "text-red-700 bg-red-50 border-red-100",
};

const PROJECT_STATUS_COLOR: Record<string, string> = {
  NEW:         "text-blue-700 bg-blue-50 border-blue-100",
  IN_PROGRESS: "text-amber-700 bg-amber-50 border-amber-100",
  REVIEW:      "text-purple-700 bg-purple-50 border-purple-100",
  DONE:        "text-emerald-700 bg-emerald-50 border-emerald-100",
  ON_HOLD:     "text-[#6B7280] bg-[#F3F4F6] border-[#E5E7EB]",
};

const ACTIVITY_LABEL: Record<string, string> = {
  CLIENT_CREATED:  "created the client",
  STATUS_CHANGED:  "changed the status",
  MANAGER_CHANGED: "reassigned the account",
  NOTE_ADDED:      "added a note",
};

const TABS = [
  { id: "timeline",  label: "Timeline",  icon: History },
  { id: "overview",  label: "Overview",  icon: Building2 },
  { id: "projects",  label: "Projects",  icon: Briefcase },
  { id: "proposals", label: "Proposals", icon: FileText },
  { id: "meetings",  label: "Meetings",  icon: CalendarDays },
  { id: "contracts", label: "Contracts", icon: FileSignature },
  { id: "notes",     label: "Notes",     icon: StickyNote },
  { id: "files",     label: "Files",     icon: FolderOpen },
] as const;

const input =
  "w-full h-11 px-3.5 bg-white border border-[#D1D5DB] rounded-lg text-[14px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#8B00FF] focus:ring-2 focus:ring-[#8B00FF]/15";
const lbl = "block text-[13px] font-medium text-[#374151] mb-1.5";

function relativeDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMAD(value: number) {
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 }).format(value);
}

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<typeof TABS[number]["id"]>("timeline");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/clients/${id}`).then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        if (r.status === 404) { router.push("/admin/clients"); return null; }
        return r.json();
      }),
      fetch("/api/admin/users").then((r) => (r.ok ? r.json() : [])),
    ]).then(([c, t]) => {
      if (c) setClient(c);
      if (Array.isArray(t)) setTeam(t);
    }).finally(() => setLoading(false));
  }, [id, router]);

  async function handleDelete() {
    if (!client) return;
    if (!confirm(`Delete "${client.companyName}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/clients/${client.id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/clients");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#8B00FF] animate-spin" />
      </div>
    );
  }
  if (!client) return null;

  return (
    <div>
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#111827] mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Back to clients
      </Link>

      {/* Header */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">
                {client.companyName}
              </h1>
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold",
                STATUS_COLORS[client.status] ?? STATUS_COLORS.ACTIVE,
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOTS[client.status] ?? STATUS_DOTS.ACTIVE)} />
                {client.status.charAt(0) + client.status.slice(1).toLowerCase()}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[13px] text-[#6B7280]">
              {client.industry && (
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> {client.industry}
                </span>
              )}
              {client.accountManager && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Managed by {client.accountManager.fullName}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> {formatMAD(client.contractValue)} MAD
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              className="inline-flex items-center gap-1.5 h-10 px-4 bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white rounded-lg text-[12px] font-semibold shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 transition-all"
              title="Schedule a meeting"
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Schedule meeting
            </button>
            {client.whatsapp && (
              <a
                href={client.whatsapp.startsWith("http") ? client.whatsapp : `https://wa.me/${client.whatsapp.replace(/\D/g, "")}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                title="WhatsApp"
              >
                <FaWhatsapp className="w-4 h-4" />
              </a>
            )}
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                title={client.email}
              >
                <Mail className="w-4 h-4" />
              </a>
            )}
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                title={client.phone}
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
            {client.website && (
              <a
                href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                title="Website"
              >
                <Globe className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E5E7EB] mb-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 overflow-x-auto">
        <div className="flex items-center gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            const count = countForTab(t.id, client);
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                  active
                    ? "border-[#8B00FF] text-[#8B00FF]"
                    : "border-transparent text-[#6B7280] hover:text-[#111827]",
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {count > 0 && (
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                    active ? "bg-purple-100 text-[#8B00FF]" : "bg-[#F3F4F6] text-[#6B7280]",
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {tab === "timeline" && (
        <TimelineTab clientId={client.id} team={team} refreshKey={refreshKey} />
      )}
      {tab === "overview" && (
        <OverviewTab
          client={client}
          team={team}
          onUpdate={setClient}
          onDelete={handleDelete}
        />
      )}
      {tab === "projects" && <ProjectsTab projects={client.projects} />}
      {tab === "proposals" && <ProposalsTab proposals={client.proposals} />}
      {tab === "meetings" && (
        <MeetingsTab
          clientId={client.id}
          companyName={client.companyName}
          refreshKey={refreshKey}
          onOpenSchedule={() => setScheduleOpen(true)}
        />
      )}
      {tab === "contracts" && (
        <ContractsTab clientId={client.id} companyName={client.companyName} refreshKey={refreshKey} />
      )}
      {tab === "notes" && <NotesTab client={client} onUpdate={setClient} team={team} />}
      {tab === "files" && <PlaceholderTab icon={<FolderOpen className="w-7 h-7" />} title="Files — coming soon" description="Phase 3 will add file attachments." />}

      <ScheduleMeetingModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onCreated={() => { setScheduleOpen(false); setRefreshKey((k) => k + 1); setTab("meetings"); }}
        context={{ kind: "client", clientId: client.id, label: client.companyName }}
      />
    </div>
  );
}

function countForTab(id: string, client: Client): number {
  switch (id) {
    case "projects":  return client.projects.length;
    case "proposals": return client.proposals.length;
    case "notes":     return client.notes.length;
    case "activity":  return client.activities.length;
    default: return 0;
  }
}

function OverviewTab({
  client, team, onUpdate, onDelete,
}: {
  client: Client; team: TeamMember[];
  onUpdate: (c: Client) => void; onDelete: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    companyName: client.companyName,
    contactPerson: client.contactPerson,
    phone: client.phone,
    whatsapp: client.whatsapp,
    email: client.email,
    website: client.website,
    industry: client.industry,
    contractValue: String(client.contractValue),
    acquisitionSource: client.acquisitionSource,
    status: client.status,
    accountManagerId: client.accountManagerId ?? "",
  });

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          contractValue: form.contractValue ? Number(form.contractValue) : 0,
          accountManagerId: form.accountManagerId || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate({ ...client, ...updated });
        setEdit(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Failed to save.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
      <div className="space-y-6 min-w-0">
        <section className="bg-white border border-[#E5E7EB] rounded-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-[15px] font-semibold text-[#111827]">Client details</h2>
            {edit ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEdit(false); setError(""); }}
                  className="h-8 px-3 text-[12px] text-[#6B7280] hover:text-[#111827]"
                >
                  <X className="w-3.5 h-3.5 inline mr-1" /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="h-8 px-3 bg-[#8B00FF] text-white rounded-md text-[12px] font-semibold disabled:opacity-60 inline-flex items-center gap-1"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEdit(true)}
                className="inline-flex items-center gap-1 h-8 px-3 text-[12px] font-medium text-[#8B00FF] hover:bg-purple-50 rounded-md"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
          </div>

          <div className="p-6">
            {edit ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Company name</label>
                    <input value={form.companyName} onChange={(e) => update("companyName", e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={lbl}>Contact person</label>
                    <input value={form.contactPerson} onChange={(e) => update("contactPerson", e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={lbl}>Email</label>
                    <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={lbl}>Phone</label>
                    <input value={form.phone} onChange={(e) => update("phone", e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={lbl}>WhatsApp</label>
                    <input value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={lbl}>Website</label>
                    <input value={form.website} onChange={(e) => update("website", e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={lbl}>Industry</label>
                    <input value={form.industry} onChange={(e) => update("industry", e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={lbl}>Contract value (MAD)</label>
                    <input type="number" min={0} value={form.contractValue} onChange={(e) => update("contractValue", e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={lbl}>Acquisition source</label>
                    <input value={form.acquisitionSource} onChange={(e) => update("acquisitionSource", e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={lbl}>Status</label>
                    <select value={form.status} onChange={(e) => update("status", e.target.value)} className={input}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={lbl}>Account manager</label>
                    <select value={form.accountManagerId} onChange={(e) => update("accountManagerId", e.target.value)} className={input}>
                      <option value="">Unassigned</option>
                      {team.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                    </select>
                  </div>
                </div>
                {error && <p className="text-[13px] text-red-700">{error}</p>}
              </div>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <Detail label="Contact person" value={client.contactPerson} />
                <Detail label="Email" value={client.email ? <a href={`mailto:${client.email}`} className="text-[#8B00FF] hover:underline">{client.email}</a> : null} />
                <Detail label="Phone" value={client.phone} />
                <Detail label="WhatsApp" value={client.whatsapp} />
                <Detail label="Website" value={client.website ? (
                  <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer" className="text-[#8B00FF] hover:underline inline-flex items-center gap-1">
                    {client.website.replace(/^https?:\/\//, "")} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null} />
                <Detail label="Industry" value={client.industry} />
                <Detail label="Contract value" value={`${formatMAD(client.contractValue)} MAD`} />
                <Detail label="Acquisition source" value={client.acquisitionSource} />
                <Detail label="Account manager" value={client.accountManager?.fullName ?? null} />
                <Detail label="Original prospect" value={client.prospect ? (
                  <Link href={`/admin/prospecting/${client.prospect.id}`} className="text-[#8B00FF] hover:underline">{client.prospect.name}</Link>
                ) : null} />
                <Detail label="Created" value={relativeDate(client.createdAt)} />
                <Detail label="Last update" value={relativeDate(client.updatedAt)} />
              </dl>
            )}
          </div>
        </section>

        <section className="bg-white border border-red-100 rounded-xl p-6 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-[14px] font-semibold text-[#111827]">Danger zone</h3>
            <p className="text-[12px] text-[#6B7280] mt-0.5">Delete this client and all linked notes, activities, and tasks.</p>
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 h-9 px-3 border border-red-200 text-red-600 rounded-lg text-[12px] font-medium hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete client
          </button>
        </section>
      </div>

      <div className="space-y-6 min-w-0">
        <TaskList
          parentType="CLIENT"
          parentId={client.id}
          parentLabel={client.companyName}
          team={team}
          title="Tasks for this client"
          emptyHint="No tasks yet. Add one to track work for this client."
        />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode | string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1">{label}</dt>
      <dd className="text-[14px] text-[#111827]">{value || <span className="text-[#9CA3AF]">—</span>}</dd>
    </div>
  );
}

function ProjectsTab({ projects }: { projects: ClientProject[] }) {
  if (projects.length === 0) {
    return <PlaceholderTab icon={<Briefcase className="w-7 h-7" />} title="No projects yet" description="Linked delivery projects will appear here." />;
  }
  return (
    <div className="space-y-3">
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/admin/pipeline?project=${p.id}`}
          className="block bg-white border border-[#E5E7EB] rounded-xl p-5 hover:border-[#D1D5DB] hover:shadow-md hover:shadow-slate-900/[0.04] transition-all"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-[#111827]">{p.name}</h3>
              {p.description && <p className="text-[13px] text-[#6B7280] mt-1 line-clamp-2">{p.description}</p>}
              <div className="flex items-center gap-3 mt-2 text-[12px] text-[#6B7280] flex-wrap">
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold", PROJECT_STATUS_COLOR[p.status] ?? PROJECT_STATUS_COLOR.NEW)}>
                  {p.status}
                </span>
                <span>{formatMAD(p.budget)} {p.currency}</span>
                {p.dueDate && <span>Due {new Date(p.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>}
                <span>{p.progress}% done</span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ProposalsTab({ proposals }: { proposals: Proposal[] }) {
  if (proposals.length === 0) {
    return <PlaceholderTab icon={<FileText className="w-7 h-7" />} title="No proposals yet" description="Proposals linked to this client will appear here." />;
  }
  return (
    <div className="space-y-3">
      {proposals.map((p) => (
        <div key={p.id} className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-[#111827]">{p.packageName || "Custom proposal"}</h3>
              <p className="text-[13px] text-[#6B7280] mt-1">
                Contact: {p.contactPerson || "—"} · Created {relativeDate(p.createdAt)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[16px] font-bold text-[#111827]">{formatMAD(p.amount)} {p.currency}</p>
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold mt-1",
                PROPOSAL_STATUS_COLOR[p.status] ?? PROPOSAL_STATUS_COLOR.DRAFT,
              )}>
                {p.status}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotesTab({ client, onUpdate, team }: { client: Client; onUpdate: (c: Client) => void; team: TeamMember[] }) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/admin/clients/${client.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const note = await res.json();
      onUpdate({ ...client, notes: [note, ...client.notes] });
      setContent("");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-3xl space-y-4">
      <form onSubmit={addNote} className="bg-white border border-[#E5E7EB] rounded-xl p-5">
        <label className={lbl}>Add a note</label>
        <MentionTextarea
          value={content}
          onChange={setContent}
          placeholder="Internal note about this client — type @ to mention a teammate."
          rows={3}
          users={team}
          className="mb-2"
        />
        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="h-9 px-4 bg-[#8B00FF] hover:bg-[#7A00E0] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {saving ? "Saving..." : "Add note"}
        </button>
      </form>

      {client.notes.length === 0 ? (
        <p className="text-[13px] text-[#9CA3AF] px-1">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {client.notes.map((n) => (
            <div key={n.id} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
              <HighlightedMentions
                text={n.content}
                users={team}
                className="text-[13px] text-[#111827] whitespace-pre-wrap leading-relaxed block"
              />
              <p className="text-[11px] text-[#9CA3AF] mt-2">
                {n.authorName && <span className="font-medium text-[#6B7280]">{n.authorName} · </span>}
                {relativeDate(n.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab({ activities }: { activities: ClientActivity[] }) {
  if (activities.length === 0) {
    return <PlaceholderTab icon={<Activity className="w-7 h-7" />} title="No activity yet" description="Status changes, notes and assignments will appear here as a timeline." />;
  }
  return (
    <div className="max-w-3xl space-y-3">
      {activities.map((a) => (
        <div key={a.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="w-2 h-2 rounded-full bg-[#8B00FF]" />
            <span className="w-px flex-1 bg-[#E5E7EB] mt-1" />
          </div>
          <div className="flex-1 pb-3 -mt-0.5">
            <p className="text-[13px] text-[#111827]">
              <span className="font-semibold">{a.userName ?? "System"}</span>{" "}
              {ACTIVITY_LABEL[a.actionType] ?? a.actionType.toLowerCase().replace(/_/g, " ")}
            </p>
            {a.details && <p className="text-[12px] text-[#6B7280] mt-0.5">{a.details}</p>}
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">{relativeDate(a.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlaceholderTab({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl p-10 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#F3F4F6] text-[#9CA3AF] mb-3">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-[#111827]">{title}</h3>
      <p className="text-[13px] text-[#6B7280] mt-1">{description}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Meetings tab — list of meetings linked to this client
// ─────────────────────────────────────────────────────────────────────────────

type ClientMeeting = {
  id: string; title: string; type: string; status: string; startAt: string;
  endAt: string | null; outcome: string; nextAction: string;
  owner: { id: string; fullName: string; avatarInitials: string } | null;
};

const MEETING_TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CALL: Phone, GOOGLE_MEET: Video, ZOOM: Video, WHATSAPP: MessageCircle, IN_PERSON: MapPin,
};
const MEETING_STATUS_STYLE: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-100",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  CANCELLED: "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]",
  NO_SHOW:   "bg-red-50 text-red-700 border-red-100",
};

function MeetingsTab({ clientId, companyName, refreshKey, onOpenSchedule }: { clientId: string; companyName: string; refreshKey: number; onOpenSchedule: () => void }) {
  const [list, setList] = useState<ClientMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/meetings?clientId=${clientId}&limit=200`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setList(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [clientId, refreshKey]);

  async function patchMeeting(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setList((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)));
    }
  }

  if (loading) return <div className="grid gap-3">{[...Array(3)].map((_, i) => <div key={i} className="os-skeleton h-16 rounded-xl" />)}</div>;
  if (list.length === 0) {
    return (
      <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl p-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 text-blue-600 mb-3">
          <CalendarDays className="w-7 h-7" />
        </div>
        <h3 className="text-[15px] font-semibold text-[#111827]">No meetings yet</h3>
        <p className="text-[13px] text-[#6B7280] mt-1 mb-4">Schedule your first meeting with {companyName}.</p>
        <button
          onClick={onOpenSchedule}
          className="inline-flex items-center gap-1.5 h-10 px-4 bg-[#8B00FF] hover:bg-[#7A00E0] text-white rounded-lg text-[13px] font-semibold"
        >
          <Plus className="w-4 h-4" /> Schedule meeting
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((m) => {
        const TypeIcon = MEETING_TYPE_ICON[m.type] ?? Phone;
        const start = new Date(m.startAt);
        const isOpen = expanded === m.id;
        const editable = m.status === "SCHEDULED" || m.status === "COMPLETED";
        return (
          <div key={m.id} className="bg-white border border-[#E5E7EB] rounded-xl">
            <button
              type="button"
              onClick={() => setExpanded((prev) => (prev === m.id ? null : m.id))}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#FAFAFE]"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#F3F4F6] text-[#475569] shrink-0">
                <TypeIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-medium text-[#111827] truncate">{m.title}</p>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0", MEETING_STATUS_STYLE[m.status] ?? MEETING_STATUS_STYLE.SCHEDULED)}>
                    {m.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-[12px] text-[#6B7280] mt-0.5">
                  {start.toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {m.owner ? ` · ${m.owner.fullName}` : ""}
                </p>
              </div>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 border-t border-[#F3F4F6] pt-4 space-y-3">
                {m.status === "SCHEDULED" && (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => patchMeeting(m.id, { status: "COMPLETED" })} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 text-[12px] font-semibold hover:bg-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark completed
                    </button>
                    <button onClick={() => patchMeeting(m.id, { status: "NO_SHOW" })} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-red-50 text-red-700 border border-red-100 text-[12px] font-semibold hover:bg-red-100">
                      <AlertCircle className="w-3.5 h-3.5" /> No show
                    </button>
                    <button onClick={() => patchMeeting(m.id, { status: "CANCELLED" })} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB] text-[12px] font-semibold hover:bg-[#E5E7EB]">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                )}
                {editable && (
                  <OutcomeEditor
                    initialOutcome={m.outcome}
                    initialNextAction={m.nextAction}
                    onSave={(outcome, nextAction) => patchMeeting(m.id, { outcome, nextAction })}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OutcomeEditor({ initialOutcome, initialNextAction, onSave }: { initialOutcome: string; initialNextAction: string; onSave: (o: string, n: string) => Promise<void> | void }) {
  const [outcome, setOutcome] = useState(initialOutcome);
  const [nextAction, setNextAction] = useState(initialNextAction);
  const [saving, setSaving] = useState(false);
  const dirty = outcome !== initialOutcome || nextAction !== initialNextAction;
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5">Outcome</label>
        <textarea
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          rows={2}
          placeholder="What was discussed? Decisions made?"
          className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-lg text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#8B00FF] focus:ring-2 focus:ring-[#8B00FF]/15"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5">Next action</label>
        <input
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          placeholder="What's the next step? Saving this will create a follow-up task."
          className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#8B00FF] focus:ring-2 focus:ring-[#8B00FF]/15"
        />
      </div>
      {dirty && (
        <button
          type="button"
          onClick={async () => { setSaving(true); await onSave(outcome, nextAction); setSaving(false); }}
          disabled={saving}
          className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#8B00FF] text-white rounded-lg text-[12px] font-semibold disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save outcome
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contracts tab
// ─────────────────────────────────────────────────────────────────────────────

type ClientContract = {
  id: string; title: string; status: string; amount: number; currency: string;
  signedDate: string | null; startDate: string | null; endDate: string | null;
  paymentTerms: string; notes: string; createdAt: string;
  proposal: { id: string; packageName: string | null } | null;
};

const CONTRACT_STATUS_STYLE: Record<string, string> = {
  DRAFT:             "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]",
  PENDING_SIGNATURE: "bg-amber-50 text-amber-700 border-amber-100",
  SIGNED:            "bg-emerald-50 text-emerald-700 border-emerald-100",
  ACTIVE:            "bg-blue-50 text-blue-700 border-blue-100",
  COMPLETED:         "bg-purple-50 text-purple-700 border-purple-100",
  CANCELLED:         "bg-red-50 text-red-700 border-red-100",
};

const CONTRACT_NEXT: Record<string, { label: string; next: string }[]> = {
  DRAFT:             [{ label: "Send for signature", next: "PENDING_SIGNATURE" }, { label: "Cancel", next: "CANCELLED" }],
  PENDING_SIGNATURE: [{ label: "Mark signed", next: "SIGNED" }, { label: "Cancel", next: "CANCELLED" }],
  SIGNED:            [{ label: "Mark active", next: "ACTIVE" }],
  ACTIVE:            [{ label: "Mark completed", next: "COMPLETED" }],
};

function ContractsTab({ clientId, companyName, refreshKey }: { clientId: string; companyName: string; refreshKey: number }) {
  const [list, setList] = useState<ClientContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/contracts?clientId=${clientId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setList(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function setStatus(id: string, status: string) {
    if (status === "SIGNED" && !confirm("Mark this contract as SIGNED? This will create the client record (if missing) and convert the prospect.")) return;
    const res = await fetch(`/api/admin/contracts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) load();
  }

  async function updateContract(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/contracts/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) load();
  }

  async function createBlank() {
    const title = prompt(`New contract title for ${companyName}:`, `Engagement — ${companyName}`);
    if (!title) return;
    const res = await fetch("/api/admin/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, clientId, status: "DRAFT" }),
    });
    if (res.ok) load();
  }

  if (loading) return <div className="grid gap-3">{[...Array(2)].map((_, i) => <div key={i} className="os-skeleton h-24 rounded-xl" />)}</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[#6B7280]">
          {list.length === 0 ? "No contracts yet." : `${list.length} contract${list.length > 1 ? "s" : ""}`}
        </p>
        <button onClick={createBlank} className="inline-flex items-center gap-1.5 h-9 px-3 bg-white border border-[#D1D5DB] text-[#374151] rounded-lg text-[12px] font-medium hover:bg-[#F9FAFB]">
          <Plus className="w-3.5 h-3.5" /> New contract
        </button>
      </div>

      {list.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mb-3">
            <FileSignature className="w-7 h-7" />
          </div>
          <h3 className="text-[15px] font-semibold text-[#111827]">No contracts yet</h3>
          <p className="text-[13px] text-[#6B7280] mt-1">Accept a proposal to auto-generate a draft, or add one manually.</p>
        </div>
      ) : list.map((c) => {
        const opened = open === c.id;
        const nextActions = CONTRACT_NEXT[c.status] ?? [];
        return (
          <div key={c.id} className="bg-white border border-[#E5E7EB] rounded-xl">
            <button type="button" onClick={() => setOpen((p) => (p === c.id ? null : c.id))} className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left hover:bg-[#FAFAFE]">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[#111827]">{c.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold", CONTRACT_STATUS_STYLE[c.status] ?? CONTRACT_STATUS_STYLE.DRAFT)}>
                    {c.status.replace("_", " ")}
                  </span>
                  <span className="text-[12px] text-[#374151] font-semibold">{formatMAD(c.amount)} {c.currency}</span>
                  {c.endDate && <span className="text-[12px] text-[#6B7280]">Ends {new Date(c.endDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                </div>
              </div>
            </button>
            {opened && (
              <div className="px-5 pb-5 border-t border-[#F3F4F6] pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Start date</label>
                    <input
                      type="date"
                      defaultValue={c.startDate ? c.startDate.slice(0, 10) : ""}
                      onBlur={(e) => updateContract(c.id, { startDate: e.target.value || null })}
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-[13px] text-[#111827]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">End date</label>
                    <input
                      type="date"
                      defaultValue={c.endDate ? c.endDate.slice(0, 10) : ""}
                      onBlur={(e) => updateContract(c.id, { endDate: e.target.value || null })}
                      className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-[13px] text-[#111827]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Payment terms</label>
                  <input
                    defaultValue={c.paymentTerms}
                    onBlur={(e) => updateContract(c.id, { paymentTerms: e.target.value })}
                    placeholder="50% upfront, 50% on delivery"
                    className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-[13px] text-[#111827]"
                  />
                </div>
                {nextActions.length > 0 && (
                  <div className="flex gap-2 flex-wrap pt-2 border-t border-[#F3F4F6]">
                    {nextActions.map((a) => (
                      <button
                        key={a.next}
                        type="button"
                        onClick={() => setStatus(c.id, a.next)}
                        className={cn(
                          "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-semibold",
                          a.next === "SIGNED" || a.next === "ACTIVE"
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : a.next === "CANCELLED"
                              ? "bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                              : "bg-[#8B00FF] text-white hover:bg-[#7A00E0]",
                        )}
                      >
                        {a.next === "SIGNED" ? <ShieldCheck className="w-3.5 h-3.5" /> : <CircleDot className="w-3.5 h-3.5" />}
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified timeline tab
// ─────────────────────────────────────────────────────────────────────────────

type TimelineItem = {
  id: string;
  kind: "note" | "activity" | "meeting" | "contract" | "proposal" | "task";
  ts: string;
  [k: string]: unknown;
};

const KIND_STYLE: Record<TimelineItem["kind"], { dot: string; chip: string; icon: React.ComponentType<{ className?: string }> }> = {
  note:     { dot: "bg-purple-500",   chip: "bg-purple-50 text-purple-700",   icon: StickyNote },
  meeting:  { dot: "bg-blue-500",     chip: "bg-blue-50 text-blue-700",       icon: CalendarDays },
  task:     { dot: "bg-amber-500",    chip: "bg-amber-50 text-amber-700",     icon: CheckCircle2 },
  contract: { dot: "bg-emerald-500",  chip: "bg-emerald-50 text-emerald-700", icon: FileSignature },
  proposal: { dot: "bg-indigo-500",   chip: "bg-indigo-50 text-indigo-700",   icon: FileText },
  activity: { dot: "bg-[#9CA3AF]",    chip: "bg-[#F3F4F6] text-[#374151]",    icon: Activity },
};

function TimelineTab({ clientId, team, refreshKey }: { clientId: string; team: TeamMember[]; refreshKey: number }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimelineItem["kind"] | "all">("all");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/clients/${clientId}/timeline`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [clientId, refreshKey]);

  const filtered = useMemo(() => filter === "all" ? items : items.filter((i) => i.kind === filter), [items, filter]);

  if (loading) return <div className="grid gap-3">{[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-16 rounded-xl" />)}</div>;
  if (items.length === 0) {
    return <PlaceholderTab icon={<History className="w-7 h-7" />} title="Timeline is empty" description="Notes, meetings, tasks, proposals and contracts will appear here as they happen." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 flex-wrap">
        {(["all", "note", "meeting", "task", "contract", "proposal", "activity"] as const).map((k) => {
          const count = k === "all" ? items.length : items.filter((i) => i.kind === k).length;
          const label = k === "all" ? "All" : k.charAt(0).toUpperCase() + k.slice(1) + "s";
          const active = filter === k;
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors",
                active ? "bg-[#8B00FF] text-white" : "bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#111827] hover:border-[#D1D5DB]",
              )}
            >
              {label}
              {count > 0 && <span className={cn("text-[10px] font-bold px-1 rounded", active ? "bg-white/25" : "bg-[#F3F4F6]")}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="relative pl-6 max-w-3xl">
        <div className="absolute left-[7px] top-0 bottom-0 w-px bg-[#E5E7EB]" />
        <div className="space-y-3">
          {filtered.map((item) => <TimelineRow key={item.id} item={item} team={team} />)}
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ item, team }: { item: TimelineItem; team: TeamMember[] }) {
  const style = KIND_STYLE[item.kind];
  return (
    <div className="relative">
      <div className={cn("absolute -left-6 top-2 w-3.5 h-3.5 rounded-full border-2 border-white", style.dot)} />
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
        <TimelineBody item={item} team={team} />
      </div>
    </div>
  );
}

function TimelineBody({ item, team }: { item: TimelineItem; team: TeamMember[] }) {
  const style = KIND_STYLE[item.kind];
  const ts = new Date(item.ts);
  const tsLabel = relativeDate(item.ts);

  if (item.kind === "note") {
    return (
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider", style.chip)}>
            <StickyNote className="w-3 h-3" /> Note
          </span>
          {item.authorName ? <span className="text-[12px] text-[#6B7280]">{item.authorName as string}</span> : null}
          <span className="text-[11px] text-[#9CA3AF] ml-auto">{tsLabel}</span>
        </div>
        <div className="text-[13px] text-[#111827] leading-relaxed whitespace-pre-wrap">
          <HighlightedMentions text={(item.content as string) ?? ""} users={team} />
        </div>
      </div>
    );
  }

  if (item.kind === "meeting") {
    const start = new Date((item.startAt as string));
    const Icon = MEETING_TYPE_ICON[item.type as string] ?? Phone;
    return (
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-medium text-[#111827]">{item.title as string}</p>
            <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border", MEETING_STATUS_STYLE[item.status as string] ?? MEETING_STATUS_STYLE.SCHEDULED)}>
              {(item.status as string).replace("_", " ")}
            </span>
            <span className="text-[11px] text-[#9CA3AF] ml-auto">{tsLabel}</span>
          </div>
          <p className="text-[12px] text-[#6B7280] mt-0.5">
            {start.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            {item.ownerName ? ` · ${item.ownerName}` : ""}
          </p>
          {item.outcome ? <p className="text-[12px] text-[#374151] mt-1 italic">&ldquo;{(item.outcome as string).slice(0, 200)}&rdquo;</p> : null}
        </div>
      </div>
    );
  }

  if (item.kind === "contract") {
    return (
      <div className="flex items-start gap-3">
        <FileSignature className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-medium text-[#111827]">{item.title as string}</p>
            <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold", CONTRACT_STATUS_STYLE[item.status as string] ?? CONTRACT_STATUS_STYLE.DRAFT)}>
              {(item.status as string).replace("_", " ")}
            </span>
            <span className="text-[11px] text-[#9CA3AF] ml-auto">{tsLabel}</span>
          </div>
          <p className="text-[12px] text-[#6B7280] mt-0.5">
            {formatMAD(item.amount as number)} {item.currency as string}
            {item.createdByName ? ` · ${item.createdByName}` : ""}
            {item.signedDate ? ` · Signed ${new Date(item.signedDate as string).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}` : ""}
          </p>
        </div>
      </div>
    );
  }

  if (item.kind === "proposal") {
    return (
      <div className="flex items-start gap-3">
        <FileText className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-medium text-[#111827]">{(item.packageName as string) || "Proposal"}</p>
            <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold", PROPOSAL_STATUS_COLOR[item.status as string] ?? PROPOSAL_STATUS_COLOR.DRAFT)}>
              {item.status as string}
            </span>
            <span className="text-[11px] text-[#9CA3AF] ml-auto">{tsLabel}</span>
          </div>
          <p className="text-[12px] text-[#6B7280] mt-0.5">
            {formatMAD(item.amount as number)} {item.currency as string}
            {item.createdByName ? ` · ${item.createdByName}` : ""}
          </p>
        </div>
      </div>
    );
  }

  if (item.kind === "task") {
    const done = (item.status as string) === "DONE";
    return (
      <div className="flex items-start gap-3">
        <CheckCircle2 className={cn("w-4 h-4 mt-0.5 shrink-0", done ? "text-emerald-600" : "text-amber-600")} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("text-[13px] font-medium", done ? "text-[#6B7280] line-through" : "text-[#111827]")}>
              {item.title as string}
            </p>
            <span className="text-[11px] text-[#9CA3AF] ml-auto">{tsLabel}</span>
          </div>
          <p className="text-[12px] text-[#6B7280] mt-0.5">
            {item.ownerName ? `${item.ownerName} · ` : ""}
            {(item.status as string).replace("_", " ")}
            {item.dueDate ? ` · Due ${new Date(item.dueDate as string).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}` : ""}
          </p>
        </div>
      </div>
    );
  }

  // activity
  return (
    <div className="flex items-start gap-3">
      <Activity className="w-4 h-4 text-[#6B7280] mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] text-[#374151]">
            <span className="font-medium text-[#111827]">{(item.userName as string) ?? "System"}</span>{" "}
            {((item.actionType as string) ?? "").toLowerCase().replace(/_/g, " ")}
          </p>
          <span className="text-[11px] text-[#9CA3AF] ml-auto">{tsLabel}</span>
        </div>
        {item.details ? <p className="text-[12px] text-[#6B7280] mt-0.5">{item.details as string}</p> : null}
      </div>
    </div>
  );
}
