"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FolderKanban, Plus, Kanban, List, Calendar, DollarSign, X, Loader2, GripVertical } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { GlassCard } from "@/components/admin/glass-card";
import { Badge } from "@/components/admin/badge";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils";

type ClientProject = {
  id: string; name: string; clientName: string; description: string;
  services: string; status: string; priority: string;
  budget: number; amountPaid: number; currency: string;
  startDate: string | null; dueDate: string | null; completedAt: string | null;
  progress: number; ownerUserId: string | null; ownerName: string | null;
  sortOrder: number; createdAt: string;
};

const STATUSES = ["NEW", "DISCOVERY", "DESIGN", "DEVELOPMENT", "REVIEW", "CLIENT_FEEDBACK", "READY_TO_LAUNCH", "LIVE", "COMPLETED", "ON_HOLD"];
const STATUS_LABELS: Record<string, string> = {
  NEW: "New", DISCOVERY: "Discovery", DESIGN: "Design", DEVELOPMENT: "Development",
  REVIEW: "Review", CLIENT_FEEDBACK: "Feedback", READY_TO_LAUNCH: "Launch Ready",
  LIVE: "Live", MAINTENANCE: "Maintenance", COMPLETED: "Completed", ON_HOLD: "On Hold",
};
const STATUS_COLORS: Record<string, { border: string; bg: string; dot: string }> = {
  NEW: { border: "border-blue-200", bg: "bg-blue-50/40", dot: "bg-blue-500" },
  DISCOVERY: { border: "border-violet-200", bg: "bg-violet-50/40", dot: "bg-violet-500" },
  DESIGN: { border: "border-pink-200", bg: "bg-pink-50/40", dot: "bg-pink-500" },
  DEVELOPMENT: { border: "border-amber-200", bg: "bg-amber-50/40", dot: "bg-amber-500" },
  REVIEW: { border: "border-cyan-200", bg: "bg-cyan-50/40", dot: "bg-cyan-500" },
  CLIENT_FEEDBACK: { border: "border-orange-200", bg: "bg-orange-50/40", dot: "bg-orange-500" },
  READY_TO_LAUNCH: { border: "border-emerald-200", bg: "bg-emerald-50/40", dot: "bg-emerald-500" },
  LIVE: { border: "border-green-200", bg: "bg-green-50/40", dot: "bg-green-600" },
  COMPLETED: { border: "border-emerald-200", bg: "bg-emerald-50/30", dot: "bg-emerald-600" },
  ON_HOLD: { border: "border-red-200", bg: "bg-red-50/40", dot: "bg-red-400" },
};
const PRIORITY_BADGE: Record<string, string> = { LOW: "default", MEDIUM: "blue", HIGH: "amber", URGENT: "red" };

export default function PipelinePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [showCreate, setShowCreate] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/admin/pipeline")
      .then((r) => { if (r.status === 401) { router.push("/admin/login"); return null; } return r.json(); })
      .then((d) => { if (d) setProjects(d); setLoading(false); });
  }, [router]);

  function refetch() {
    fetch("/api/admin/pipeline").then((r) => r.ok ? r.json() : []).then(setProjects);
  }

  function handleDragStart(id: string) { setDragId(id); }
  function handleDragOver(e: React.DragEvent, status: string) { e.preventDefault(); setDragOverCol(status); }
  function handleDragLeave() { setDragOverCol(null); }

  async function handleDrop(targetStatus: string) {
    if (!dragId) return;
    setDragOverCol(null);
    const project = projects.find((p) => p.id === dragId);
    if (!project || project.status === targetStatus) { setDragId(null); return; }

    setProjects((prev) => prev.map((p) => p.id === dragId ? { ...p, status: targetStatus } : p));
    setDragId(null);

    await fetch(`/api/admin/pipeline/${dragId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: targetStatus }),
    });
  }

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  }

  const sorted = [...projects].sort((a, b) => {
    const va = (a as Record<string, unknown>)[sortBy];
    const vb = (b as Record<string, unknown>)[sortBy];
    const cmp = String(va ?? "").localeCompare(String(vb ?? ""), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const activeProjects = projects.filter((p) => !["COMPLETED", "ON_HOLD"].includes(p.status));
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const avgProgress = projects.length > 0 ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0;

  const visibleStatuses = STATUSES.filter((s) => projects.some((p) => p.status === s) || ["NEW", "DISCOVERY", "DESIGN", "DEVELOPMENT", "REVIEW", "LIVE"].includes(s));

  if (loading) {
    return (
      <div>
        <PageHeader title="Pipeline" subtitle="Client projects & delivery" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="Client projects & delivery"
        count={projects.length}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="flex items-center bg-white border border-[var(--os-border)] rounded-lg p-0.5">
              <button onClick={() => setView("kanban")} className={cn("p-1.5 rounded-md transition-colors", view === "kanban" ? "bg-gradient-to-r from-[#8B00FF]/10 to-[#C026D3]/10 text-[#8B00FF]" : "text-[#475569] hover:text-[#0F172A]")}>
                <Kanban className="w-4 h-4" />
              </button>
              <button onClick={() => setView("table")} className={cn("p-1.5 rounded-md transition-colors", view === "table" ? "bg-gradient-to-r from-[#8B00FF]/10 to-[#C026D3]/10 text-[#8B00FF]" : "text-[#475569] hover:text-[#0F172A]")}>
                <List className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#8B00FF] to-[#C026D3] hover:opacity-90 text-white rounded-lg text-xs sm:text-sm font-medium transition-all shadow-md shadow-purple-500/20">
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard value={projects.length} label="Total Projects" icon={<FolderKanban className="w-5 h-5" />} index={0} />
        <StatCard value={activeProjects.length} label="Active" icon={<Kanban className="w-5 h-5" />} accent index={1} />
        <StatCard value={Math.round(totalBudget / 1000)} suffix="K" label="Budget (MAD)" icon={<DollarSign className="w-5 h-5" />} index={2} />
        <StatCard value={avgProgress} suffix="%" label="Avg Progress" icon={<Calendar className="w-5 h-5" />} index={3} />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-7 h-7" />}
          title="No projects yet"
          description="Create your first client project to start tracking delivery."
          action={<button onClick={() => setShowCreate(true)} className="text-sm text-[#8B00FF] hover:text-[#7600D6] font-medium">Create project</button>}
        />
      ) : view === "kanban" ? (
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-3" style={{ minWidth: visibleStatuses.length * 260 }}>
            {visibleStatuses.map((status) => {
              const cols = STATUS_COLORS[status] || STATUS_COLORS.NEW;
              const items = projects.filter((p) => p.status === status);
              return (
                <div
                  key={status}
                  className={cn("flex-1 min-w-[240px] max-w-[300px] rounded-xl border p-3", cols.border, cols.bg, dragOverCol === status && "ring-2 ring-[#8B00FF]/30")}
                  onDragOver={(e) => handleDragOver(e, status)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(status)}
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", cols.dot)} />
                      <span className="text-[11px] font-semibold text-[#0F172A] uppercase tracking-wide">{STATUS_LABELS[status]}</span>
                    </div>
                    <span className="text-[10px] font-bold text-[#64748B] bg-white/80 px-1.5 py-0.5 rounded-full">{items.length}</span>
                  </div>
                  <div className="space-y-2 min-h-[100px]">
                    {items.map((p) => (
                      <motion.div
                        key={p.id}
                        draggable
                        onDragStart={() => handleDragStart(p.id)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: dragId === p.id ? 0.5 : 1, y: 0 }}
                        className="p-3 rounded-lg bg-white border border-[#E5E7EB] hover:border-[#D1D5DB] hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-[13px] font-semibold text-[#0F172A] truncate">{p.name}</span>
                          <GripVertical className="w-3.5 h-3.5 text-[#CBD5E1] shrink-0" />
                        </div>
                        <p className="text-[11px] text-[#64748B] mb-2">{p.clientName}</p>
                        {p.budget > 0 && <p className="text-[11px] font-medium text-[#0F172A] mb-1.5">{p.budget.toLocaleString()} {p.currency}</p>}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#8B00FF] to-[#C026D3]" style={{ width: `${p.progress}%` }} />
                          </div>
                          <span className="text-[10px] font-medium text-[#64748B]">{p.progress}%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={PRIORITY_BADGE[p.priority] as "default" | "blue" | "amber" | "red"} size="sm">{p.priority}</Badge>
                          {p.dueDate && (
                            <span className={cn("text-[10px]", new Date(p.dueDate) < new Date() ? "text-red-500 font-medium" : "text-[#64748B]")}>
                              {new Date(p.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                            </span>
                          )}
                          {p.ownerName && <span className="text-[10px] text-[#64748B] ml-auto">{p.ownerName.split(" ")[0]}</span>}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border border-[var(--os-border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--os-border)] bg-gray-50">
                  {[
                    { key: "name", label: "Project" },
                    { key: "clientName", label: "Client" },
                    { key: "status", label: "Status" },
                    { key: "budget", label: "Budget" },
                    { key: "progress", label: "Progress" },
                    { key: "dueDate", label: "Due Date" },
                    { key: "priority", label: "Priority" },
                    { key: "ownerName", label: "Owner" },
                  ].map((col) => (
                    <th key={col.key} onClick={() => toggleSort(col.key)} className="text-left px-4 py-2.5 text-[#475569] font-medium text-[11px] uppercase tracking-wider cursor-pointer hover:text-[#0F172A] transition-colors">
                      {col.label} {sortBy === col.key && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--os-border)] hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="text-[#0F172A] font-medium text-[13px]">{p.name}</span>
                      {p.services && <p className="text-[10px] text-[#64748B] truncate max-w-[200px]">{p.services}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-[#475569] text-xs">{p.clientName}</td>
                    <td className="px-4 py-2.5"><Badge variant={STATUS_COLORS[p.status] ? "purple" : "default"} size="sm">{STATUS_LABELS[p.status] || p.status}</Badge></td>
                    <td className="px-4 py-2.5 text-[#0F172A] text-xs font-medium">{p.budget > 0 ? `${p.budget.toLocaleString()} ${p.currency}` : "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#8B00FF] to-[#C026D3]" style={{ width: `${p.progress}%` }} />
                        </div>
                        <span className="text-[10px] text-[#64748B]">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[#64748B] text-xs">{p.dueDate ? new Date(p.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—"}</td>
                    <td className="px-4 py-2.5"><Badge variant={PRIORITY_BADGE[p.priority] as "default" | "blue" | "amber" | "red"} size="sm">{p.priority}</Badge></td>
                    <td className="px-4 py-2.5 text-[#475569] text-xs">{p.ownerName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} onCreated={refetch} />}
      </AnimatePresence>
    </div>
  );
}

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", clientName: "", description: "", services: "", budget: "", startDate: "", dueDate: "", priority: "MEDIUM", status: "NEW", ownerName: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.clientName) { setError("Name and client are required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/admin/pipeline", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, budget: parseFloat(form.budget) || 0, startDate: form.startDate || null, dueDate: form.dueDate || null }),
    });
    if (res.ok) { onCreated(); onClose(); }
    else { const d = await res.json(); setError(typeof d.error === "string" ? d.error : "Failed"); }
    setSaving(false);
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E5E7EB] shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-[#F1F5F9]">
            <h2 className="text-[16px] font-semibold text-[#0F172A]">New Project</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9]"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[#475569] mb-1.5">Project Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/20" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#475569] mb-1.5">Client Name *</label>
                <input value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} required className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/20" />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#475569] mb-1.5">Services</label>
              <input value={form.services} onChange={(e) => setForm((f) => ({ ...f, services: e.target.value }))} placeholder="Website, SEO, Branding..." className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/20" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#475569] mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/20 resize-none" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[#475569] mb-1.5">Budget (MAD)</label>
                <input type="number" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/20" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#475569] mb-1.5">Start Date</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/20" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#475569] mb-1.5">Due Date</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/20" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[#475569] mb-1.5">Priority</label>
                <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/20 cursor-pointer">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#475569] mb-1.5">Owner</label>
                <input value={form.ownerName} onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))} placeholder="Team member name" className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/20" />
              </div>
            </div>
            {error && <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[13px]">{error}</div>}
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white rounded-xl text-[13px] font-medium shadow-sm hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Project
              </button>
              <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white border border-[#E2E8F0] text-[#475569] rounded-xl text-[13px] font-medium hover:bg-[#F8FAFC] transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  );
}
