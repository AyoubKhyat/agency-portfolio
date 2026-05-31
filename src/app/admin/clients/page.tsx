"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Phone, Mail, MapPin, Globe, MessageCircle, Calendar, Tag, UserCheck, Users } from "lucide-react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import { PageHeader } from "@/components/admin/page-header";
import { GlassCard } from "@/components/admin/glass-card";
import { Badge } from "@/components/admin/badge";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { cn } from "@/lib/utils";
import Link from "next/link";

type ConvertedProspect = {
  id: string; name: string; phone: string; whatsappLink: string;
  sector: string; neighborhood: string; instagram: string;
  hasWebsite: boolean; status: string; createdAt: string; updatedAt: string;
  notes: { id: string; content: string; createdAt: string }[];
};

type QualifiedLead = {
  id: string; fullName: string; email: string; phone: string | null;
  subject: string; message: string; status: string; createdAt: string; updatedAt: string;
  notes: { id: string; content: string; createdAt: string }[];
};

export default function ClientsPage() {
  const router = useRouter();
  const [prospects, setProspects] = useState<ConvertedProspect[]>([]);
  const [leads, setLeads] = useState<QualifiedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/admin/clients")
      .then((r) => { if (r.status === 401) { router.push("/admin/login"); return null; } return r.json(); })
      .then((d) => {
        if (d) {
          setProspects(d.convertedProspects || []);
          setLeads(d.qualifiedLeads || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  function relativeDate(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  }

  const totalClients = prospects.length + leads.length;
  const filteredProspects = filter === "ALL" || filter === "PROSPECTS" ? prospects : [];
  const filteredLeads = filter === "ALL" || filter === "LEADS" ? leads : [];

  if (loading) {
    return (
      <div>
        <PageHeader title="Clients" subtitle="Converted prospects and qualified leads" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="os-skeleton h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Clients" count={totalClients} subtitle="Converted prospects and qualified leads" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard value={totalClients} label="Total Clients" icon={<Building2 className="w-5 h-5" />} index={0} />
        <StatCard value={prospects.length} label="From Prospecting" icon={<UserCheck className="w-5 h-5" />} accent index={1} />
        <StatCard value={leads.length} label="From Contact Form" icon={<Users className="w-5 h-5" />} index={2} />
      </div>

      {/* Filter */}
      <div className="mt-6">
        <FilterTabs
          items={[
            { value: "ALL", label: "All Clients" },
            { value: "PROSPECTS", label: `Prospecting (${prospects.length})` },
            { value: "LEADS", label: `Contact Form (${leads.length})` },
          ]}
          active={filter}
          onChange={setFilter}
          className="mb-4"
        />
      </div>

      {totalClients === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="No clients yet"
          description="Convert prospects or qualify leads to see them here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Converted Prospects */}
          {filteredProspects.map((p, i) => (
            <motion.div key={`p-${p.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.03 }}>
              <GlassCard padding="lg" hover className="h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center text-sm font-bold text-purple-700">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <Link href={`/admin/prospecting/${p.id}`} className="text-[14px] font-semibold text-[#0F172A] hover:text-purple-600 transition-colors">
                        {p.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="purple" size="sm">Prospecting</Badge>
                        <Badge variant="default" size="sm">{p.sector}</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-[12px] text-[#475569] mb-3">
                  {p.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      <span>{p.phone}</span>
                      {p.whatsappLink && (
                        <a href={p.whatsappLink} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-600"><FaWhatsapp className="w-3 h-3" /></a>
                      )}
                    </div>
                  )}
                  {p.instagram && (
                    <div className="flex items-center gap-2">
                      <FaInstagram className="w-3 h-3" />
                      <a href={`https://instagram.com/${p.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 transition-colors">@{p.instagram.replace(/^@/, "")}</a>
                    </div>
                  )}
                  {p.neighborhood && (
                    <div className="flex items-center gap-2"><MapPin className="w-3 h-3" /><span>{p.neighborhood}</span></div>
                  )}
                </div>

                {p.notes?.[0] && (
                  <div className="text-[11px] text-[#64748B] bg-gray-50/80 rounded-lg p-2 border border-[var(--os-border)]">
                    <span className="text-[#475569]">{p.notes[0].content.slice(0, 100)}{p.notes[0].content.length > 100 ? "..." : ""}</span>
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--os-border)]">
                  <span className="text-[10px] text-[#64748B] flex items-center gap-1"><Calendar className="w-3 h-3" /> Converted {relativeDate(p.updatedAt)}</span>
                </div>
              </GlassCard>
            </motion.div>
          ))}

          {/* Qualified Leads */}
          {filteredLeads.map((l, i) => (
            <motion.div key={`l-${l.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: (filteredProspects.length + i) * 0.03 }}>
              <GlassCard padding="lg" hover className="h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-sm font-bold text-blue-600">
                      {l.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <Link href={`/admin/leads/${l.id}`} className="text-[14px] font-semibold text-[#0F172A] hover:text-purple-600 transition-colors">
                        {l.fullName}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="blue" size="sm">Contact Form</Badge>
                        <Badge variant={l.status === "QUALIFIED" ? "green" : "default"} size="sm">{l.status}</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-[12px] text-[#475569] mb-3">
                  <div className="flex items-center gap-2"><Mail className="w-3 h-3" /><span>{l.email}</span></div>
                  {l.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3" /><span>{l.phone}</span></div>}
                  <div className="flex items-center gap-2"><Tag className="w-3 h-3" /><span className="truncate">{l.subject}</span></div>
                </div>

                <div className="text-[11px] text-[#64748B] bg-gray-50/80 rounded-lg p-2 border border-[var(--os-border)]">
                  <span className="text-[#475569]">{l.message.slice(0, 120)}{l.message.length > 120 ? "..." : ""}</span>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--os-border)]">
                  <span className="text-[10px] text-[#64748B] flex items-center gap-1"><Calendar className="w-3 h-3" /> {relativeDate(l.createdAt)}</span>
                  {l.notes?.length > 0 && <span className="text-[10px] text-[#64748B] flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {l.notes.length} note{l.notes.length > 1 ? "s" : ""}</span>}
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
