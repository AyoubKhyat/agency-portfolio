"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, ExternalLink, MessageCircle, Phone, Mail, Globe,
  Briefcase, FileText, StickyNote, CalendarDays, FolderOpen, Activity,
  Building2, User, DollarSign, Tag, Loader2, Send, Edit2, Save, X,
  Trash2,
} from "lucide-react";
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
  { id: "overview",  label: "Overview",  icon: Building2 },
  { id: "projects",  label: "Projects",  icon: Briefcase },
  { id: "proposals", label: "Proposals", icon: FileText },
  { id: "notes",     label: "Notes",     icon: StickyNote },
  { id: "meetings",  label: "Meetings",  icon: CalendarDays },
  { id: "files",     label: "Files",     icon: FolderOpen },
  { id: "activity",  label: "Activity",  icon: Activity },
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
  const [tab, setTab] = useState<typeof TABS[number]["id"]>("overview");

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
      {tab === "notes" && <NotesTab client={client} onUpdate={setClient} team={team} />}
      {tab === "meetings" && <PlaceholderTab icon={<CalendarDays className="w-7 h-7" />} title="Meetings — coming soon" description="Phase 2 will add the meetings module." />}
      {tab === "files" && <PlaceholderTab icon={<FolderOpen className="w-7 h-7" />} title="Files — coming soon" description="Phase 3 will add file attachments." />}
      {tab === "activity" && <ActivityTab activities={client.activities} />}
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
