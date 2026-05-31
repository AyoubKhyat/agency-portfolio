"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HiOutlinePlus, HiOutlineArrowUpTray, HiOutlinePaperAirplane, HiOutlinePencilSquare, HiOutlineTrash, HiOutlineChatBubbleLeft, HiOutlineEye } from "react-icons/hi2";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import AvatarChip from "@/components/AvatarChip";

type MsgTemplate = (ig: string, followers: string) => string;

const TEMPLATES: Record<string, MsgTemplate[]> = {
  "Dentiste": [
    (ig, f) => `Bonjour Docteur, je suis Ayoub d'Ibda3 Digital à Marrakech.${ig ? ` Je suis tombé sur votre page @${ig}${f} et je vois que vous avez une belle communauté.` : ""} Petite question : est-ce que vos patients peuvent prendre RDV en ligne ? La plupart des cabinets qui ont un site avec réservation intégrée voient +40% de nouveaux patients. Si ça vous parle, voici ce qu'on fait : https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour,${ig ? ` j'ai découvert votre cabinet via @${ig}${f}.` : ""} Je suis développeur web à Marrakech et je me suis dit qu'un site pro avec vos spécialités, photos du cabinet et prise de RDV en ligne pourrait vraiment vous démarquer des autres cabinets du quartier. On en parle 10 min ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Salam Docteur ! Ayoub ici, agence web Ibda3 Digital.${ig ? ` J'ai vu @${ig}${f}, top contenu !` : ""} Je contacte quelques professionnels de santé à Marrakech parce qu'on lance une offre spéciale sites web pour cabinets. Ça vous intéresserait de voir ce qu'on propose ? https://ibda3-digital.vercel.app`,
  ],
  "Salon Beauté": [
    (ig, f) => `Salam ! Je suis Ayoub d'Ibda3 Digital.${ig ? ` J'ai scrollé votre feed @${ig}${f} — les résultats sont vraiment canon !` : ""} Je me demandais : vos clientes vous trouvent comment en dehors d'Instagram ? Un site avec galerie avant/après, tarifs et réservation en ligne ça change tout. Jetez un oeil : https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour ! Ayoub de l'agence Ibda3 Digital ici.${ig ? ` Votre page @${ig}${f} m'a tapé dans l'oeil,` : " Votre salon m'a l'air super,"} et je me suis dit qu'un beau site vitrine serait le parfait complément à votre Instagram — vos clientes pourraient réserver en 2 clics, de jour comme de nuit. Voici notre travail : https://ibda3-digital.vercel.app`,
    (ig, f) => `Hello ! Je suis Ayoub, développeur web à Marrakech.${ig ? ` En passant sur @${ig}${f}, j'ai vu que vous n'avez pas encore de site web.` : ""} Saviez-vous que 60% des clientes cherchent "salon beauté Marrakech" sur Google avant de choisir ? Un site optimisé vous placerait en tête. On peut en discuter ? https://ibda3-digital.vercel.app`,
  ],
};

const DEFAULT_TEMPLATES: MsgTemplate[] = [
  (ig, f) => `Bonjour ! Je suis Ayoub d'Ibda3 Digital, agence web à Marrakech.${ig ? ` J'ai vu @${ig}${f} et j'ai beaucoup aimé ce que vous faites.` : ""} Un site web professionnel pourrait vraiment booster votre visibilité en ligne. Voici notre portfolio : https://ibda3-digital.vercel.app`,
  (ig, f) => `Salam !${ig ? ` Belle page @${ig}${f} !` : ""} Je suis développeur web à Marrakech. Un site moderne et optimisé Google pourrait vous apporter de nouveaux clients. On en parle ? https://ibda3-digital.vercel.app`,
];

const FOLLOWUP_TEMPLATES: MsgTemplate[] = [
  (ig) => `Bonjour ! C'est Ayoub d'Ibda3 Digital. Je vous avais contacté il y a quelques semaines concernant la création d'un site web.${ig ? ` J'avais vu votre page @${ig} et je reste convaincu qu'un site professionnel pourrait vraiment booster votre activité.` : ""} Est-ce que ça vous intéresserait d'en discuter rapidement ? https://ibda3-digital.vercel.app`,
  (ig) => `Salam ! Ayoub d'Ibda3 Digital ici. Je me permets de revenir vers vous — on propose en ce moment des tarifs spéciaux pour les entreprises à Marrakech.${ig ? ` Votre activité sur @${ig} mérite un beau site.` : ""} 10 min pour en parler ? https://ibda3-digital.vercel.app`,
  (ig) => `Bonjour, c'est Ayoub de l'agence Ibda3 Digital. Je vous avais écrit il y a quelque temps. Pas de souci si ce n'est pas le bon moment, mais si un jour vous pensez à créer un site web, on est là. Notre portfolio : https://ibda3-digital.vercel.app`,
  (ig) => `Hello ! Ayoub d'Ibda3 Digital. Juste un petit rappel — on crée des sites web modernes pour les entreprises à Marrakech.${ig ? ` J'avais beaucoup aimé ce que vous faites sur @${ig}.` : ""} Si ça vous parle, je suis dispo pour un appel. https://ibda3-digital.vercel.app`,
];

let sendCounter = 0;
let followupCounter = 0;

function getPersonalizedMessage(p: Prospect, noteContent: string): string {
  const templates = TEMPLATES[p.sector] || DEFAULT_TEMPLATES;
  const idx = sendCounter % templates.length;
  sendCounter++;
  const ig = p.instagram?.replace(/^@/, "") || "";
  let followers = "";
  if (noteContent) {
    const match = noteContent.match(/(\d+K?\+?)\s*followers/i);
    if (match) followers = `, ${match[1]} abonnés — bravo`;
  }
  return templates[idx](ig, followers);
}

function getFollowupMessage(p: Prospect): string {
  const idx = followupCounter % FOLLOWUP_TEMPLATES.length;
  followupCounter++;
  const ig = p.instagram?.replace(/^@/, "") || "";
  return FOLLOWUP_TEMPLATES[idx](ig, "");
}

const STATUSES = ["ALL", "A_ENVOYER", "ENVOYE", "REPONDU", "PAS_DE_WHATSAPP", "CONVERTI"] as const;
const STATUS_LABELS: Record<string, string> = { ALL: "All", A_ENVOYER: "To Send", ENVOYE: "Sent", REPONDU: "Replied", PAS_DE_WHATSAPP: "No WA", CONVERTI: "Converted" };
const STATUS_COLORS: Record<string, string> = {
  A_ENVOYER: "bg-blue-50 text-blue-600 border-blue-100",
  ENVOYE: "bg-amber-50 text-amber-600 border-amber-100",
  REPONDU: "bg-emerald-50 text-emerald-600 border-emerald-100",
  PAS_DE_WHATSAPP: "bg-red-50 text-red-500 border-red-100",
  CONVERTI: "bg-violet-50 text-violet-600 border-violet-100",
};
const PRIORITY_LABELS: Record<number, string> = { 1: "IG sans site", 2: "Sans site", 3: "A un site" };
const SECTORS = [
  "ALL", "Dentiste", "Salon Beauté", "Salle de Sport", "Avocat",
  "Architecte/Décorateur", "Immobilier", "Restaurant/Café",
  "Patisserie", "Boulangerie", "Riad/Maison d'hôtes",
  "Photographe/Vidéaste", "Traiteur",
];

type Owner = { id: string; fullName: string; avatarInitials: string };
type Prospect = {
  id: string; name: string; phone: string; whatsappLink: string; sector: string;
  neighborhood: string; instagram: string; hasWebsite: boolean; priority: number;
  status: string; sentAt: string | null; createdAt: string; owner: Owner | null;
  notes: { id: string; content: string; createdAt: string }[];
};
type TeamUser = { id: string; fullName: string; avatarInitials: string };

export default function ProspectingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" /></div>}>
      <ProspectingContent />
    </Suspense>
  );
}

function ProspectingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "ALL";
  const sectorFilter = searchParams.get("sector") ?? "ALL";
  const ownerFilter = searchParams.get("owner") ?? "ALL";
  const pageParam = parseInt(searchParams.get("page") ?? "1", 10);

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [kpi, setKpi] = useState({ total: 0, assigned: 0, unassigned: 0, replied: 0, converted: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/users").then((r) => r.ok ? r.json() : []).then((users) => setTeamUsers(users.filter((u: { isActive: boolean }) => u.isActive))).catch(() => {});
    Promise.all([
      fetch("/api/admin/prospecting?page=1").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/prospecting?status=REPONDU&page=1").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/prospecting?status=CONVERTI&page=1").then((r) => r.ok ? r.json() : null),
      fetch("/api/admin/prospecting?owner=UNASSIGNED&page=1").then((r) => r.ok ? r.json() : null),
    ]).then(([all, replied, converted, unassigned]) => {
      setKpi({
        total: all?.total ?? 0,
        assigned: (all?.total ?? 0) - (unassigned?.total ?? 0),
        unassigned: unassigned?.total ?? 0,
        replied: replied?.total ?? 0,
        converted: converted?.total ?? 0,
      });
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    const qs = new URLSearchParams();
    if (statusFilter !== "ALL") qs.set("status", statusFilter);
    if (sectorFilter !== "ALL") qs.set("sector", sectorFilter);
    if (ownerFilter !== "ALL") qs.set("owner", ownerFilter);
    qs.set("page", String(pageParam));
    fetch(`/api/admin/prospecting?${qs}`).then((r) => {
      if (r.status === 401) { router.push("/admin/login"); return null; }
      return r.json();
    }).then((data) => {
      if (data) { setProspects(data.prospects); setTotal(data.total); setPages(data.pages); }
      setLoading(false);
    });
  }, [statusFilter, sectorFilter, ownerFilter, pageParam, router]);

  function navigate(status: string, sector: string, owner: string, page = 1) {
    const qs = new URLSearchParams();
    if (status !== "ALL") qs.set("status", status);
    if (sector !== "ALL") qs.set("sector", sector);
    if (owner !== "ALL") qs.set("owner", owner);
    if (page > 1) qs.set("page", String(page));
    router.push(`/admin/prospecting${qs.toString() ? `?${qs}` : ""}`);
  }

  function openLink(url: string) {
    const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  async function handleSend(p: Prospect) {
    const noteContent = p.notes?.[0]?.content || "";
    const msg = getPersonalizedMessage(p, noteContent);
    const digits = p.phone?.replace(/\D/g, "") || "";
    const isLandline = /^0?5\d{8}$/.test(digits) || /^2125\d{8}$/.test(digits);
    const hasMobile = p.phone && !isLandline;
    if (hasMobile) {
      let phone = digits;
      if (phone.startsWith("0")) phone = "212" + phone.slice(1);
      else if (!phone.startsWith("212") && !phone.startsWith("33")) phone = "212" + phone;
      openLink(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
    } else if (p.instagram) {
      navigator.clipboard.writeText(msg).catch(() => {});
      openLink(`https://ig.me/m/${p.instagram.replace(/^@/, "")}`);
    } else { return; }
    if (p.status === "A_ENVOYER" || p.status === "PAS_DE_WHATSAPP") {
      const actionType = hasMobile ? "SENT_WHATSAPP" : "SENT_INSTAGRAM";
      const res = await fetch(`/api/admin/prospecting/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ENVOYE", actionType }) });
      if (res.ok) setProspects((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, status: "ENVOYE", sentAt: new Date().toISOString() } : pr));
    }
  }

  async function handleFollowUp(p: Prospect) {
    const msg = getFollowupMessage(p);
    const digits = p.phone?.replace(/\D/g, "") || "";
    const isLandline = /^0?5\d{8}$/.test(digits) || /^2125\d{8}$/.test(digits);
    const hasMobile = p.phone && !isLandline;
    if (hasMobile) {
      let phone = digits;
      if (phone.startsWith("0")) phone = "212" + phone.slice(1);
      else if (!phone.startsWith("212") && !phone.startsWith("33")) phone = "212" + phone;
      openLink(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
    } else if (p.instagram) {
      navigator.clipboard.writeText(msg).catch(() => {});
      openLink(`https://ig.me/m/${p.instagram.replace(/^@/, "")}`);
    } else { return; }
    await fetch(`/api/admin/prospecting/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ENVOYE", actionType: "FOLLOW_UP" }) }).catch(() => {});
    setProspects((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, status: "ENVOYE", sentAt: new Date().toISOString() } : pr));
  }

  async function handleMarkReplied(p: Prospect) {
    await fetch(`/api/admin/prospecting/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "REPONDU", actionType: "MARKED_REPLIED" }) });
    setProspects((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, status: "REPONDU" } : pr));
  }

  async function handleAssign(prospectId: string, ownerUserId: string | null) {
    await fetch(`/api/admin/prospecting/${prospectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerUserId }) });
    const owner = ownerUserId ? teamUsers.find((u) => u.id === ownerUserId) || null : null;
    setProspects((prev) => prev.map((pr) => pr.id === prospectId ? { ...pr, owner } : pr));
  }

  async function handleBulkAssign(ownerUserId: string | null) {
    if (selected.size === 0) return;
    setBulkAssigning(true);
    await fetch("/api/admin/prospecting/bulk-assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prospectIds: Array.from(selected), ownerUserId }) });
    const owner = ownerUserId ? teamUsers.find((u) => u.id === ownerUserId) || null : null;
    setProspects((prev) => prev.map((pr) => selected.has(pr.id) ? { ...pr, owner } : pr));
    setSelected(new Set());
    setBulkAssigning(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = await fetch(`/api/admin/prospecting/${id}`, { method: "DELETE" });
    if (res.ok) setProspects((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true);
    const formData = new FormData(); formData.append("file", file);
    const res = await fetch("/api/admin/prospecting/import", { method: "POST", body: formData });
    const data = await res.json();
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.ok) { alert(`Imported ${data.imported} prospects.`); navigate(statusFilter, sectorFilter, ownerFilter, 1); }
    else alert(`Import failed: ${data.error}`);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  const kpiCards = [
    { label: "Total", value: kpi.total, color: "text-gray-900" },
    { label: "Assigned", value: kpi.assigned, color: "text-violet-600" },
    { label: "Unassigned", value: kpi.unassigned, color: "text-amber-600" },
    { label: "Replies", value: kpi.replied, color: "text-emerald-600" },
    { label: "Converted", value: kpi.converted, color: "text-purple-600" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Prospecting</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} prospects</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-[13px] font-medium text-gray-600 transition-colors">
            <HiOutlineArrowUpTray className="w-4 h-4" />
            {importing ? "Importing..." : "Import"}
          </button>
          <Link href="/admin/prospecting/new" className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-[13px] font-medium shadow-sm shadow-violet-200 hover:shadow-md hover:shadow-violet-200 transition-all">
            <HiOutlinePlus className="w-4 h-4" />
            New Prospect
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <p className={`text-2xl font-semibold ${k.color}`}>{k.value}</p>
            <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-wide">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-2.5 mb-6">
        {/* Status pills */}
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => navigate(s, sectorFilter, ownerFilter)} className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all ${statusFilter === s ? "bg-gray-900 text-white" : "bg-white text-gray-500 border border-gray-150 hover:border-gray-300"}`}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        {/* Sector pills */}
        <div className="flex flex-wrap gap-1.5">
          {SECTORS.map((s) => (
            <button key={s} onClick={() => navigate(statusFilter, s, ownerFilter)} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${sectorFilter === s ? "bg-violet-100 text-violet-700" : "bg-white text-gray-500 border border-gray-150 hover:border-gray-300"}`}>
              {s === "ALL" ? "All Sectors" : s}
            </button>
          ))}
        </div>
        {/* Owner pills */}
        {teamUsers.length > 0 && (
          <div className="flex gap-2 items-center">
            <span className="text-[11px] text-gray-400 uppercase tracking-wide mr-1">Owner:</span>
            <button onClick={() => navigate(statusFilter, sectorFilter, "ALL")} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${ownerFilter === "ALL" ? "bg-gray-900 text-white" : "bg-white text-gray-500 border border-gray-150 hover:border-gray-300"}`}>
              All
            </button>
            <button onClick={() => navigate(statusFilter, sectorFilter, "UNASSIGNED")} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${ownerFilter === "UNASSIGNED" ? "bg-amber-100 text-amber-700" : "bg-white text-gray-500 border border-gray-150 hover:border-gray-300"}`}>
              Unassigned
            </button>
            {teamUsers.map((u) => (
              <AvatarChip key={u.id} initials={u.avatarInitials} name={u.fullName} showName={false} size="sm" onClick={() => navigate(statusFilter, sectorFilter, u.id)} active={ownerFilter === u.id} />
            ))}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-violet-50 border border-violet-100 rounded-2xl">
          <span className="text-[13px] font-medium text-violet-700">{selected.size} selected</span>
          <div className="flex gap-1.5 ml-2">
            {teamUsers.map((u) => (
              <AvatarChip key={u.id} initials={u.avatarInitials} name={u.fullName} showName={false} size="sm" onClick={() => handleBulkAssign(u.id)} />
            ))}
            <button onClick={() => handleBulkAssign(null)} disabled={bulkAssigning} className="px-3 py-1 text-[11px] font-medium text-gray-500 bg-white border border-gray-200 rounded-full hover:border-gray-300">
              Unassign
            </button>
          </div>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[12px] text-gray-400 hover:text-gray-600">Clear</button>
        </div>
      )}

      {/* Prospect Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" /></div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-20"><p className="text-gray-400 text-sm">No prospects found.</p></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {prospects.map((p) => {
              const isSelected = selected.has(p.id);
              const canFollowUp = p.status === "ENVOYE" && p.sentAt && (Date.now() - new Date(p.sentAt).getTime()) > 3 * 86400000;
              return (
                <div key={p.id} className={`group relative bg-white rounded-2xl border p-5 transition-all duration-200 hover:shadow-lg hover:shadow-gray-100/60 ${isSelected ? "border-violet-300 ring-1 ring-violet-200" : "border-gray-100 hover:border-gray-200"}`}>
                  {/* Checkbox */}
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)} className="absolute top-4 right-4 w-4 h-4 rounded border-gray-300 text-violet-500 focus:ring-violet-500/20 opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity cursor-pointer" />

                  {/* Business name + sector */}
                  <Link href={`/admin/prospecting/${p.id}`} className="block mb-3">
                    <h3 className="text-[15px] font-semibold text-gray-900 hover:text-violet-600 transition-colors leading-tight">{p.name}</h3>
                    {p.instagram && <p className="text-[12px] text-gray-400 mt-0.5">@{p.instagram.replace(/^@/, "")}</p>}
                  </Link>

                  {/* Sector + Location */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">{p.sector}</span>
                    {p.neighborhood && <span className="text-[11px] text-gray-400">{p.neighborhood}</span>}
                  </div>

                  {/* Owner + Status */}
                  <div className="flex items-center justify-between mb-4">
                    {/* Owner avatar selector */}
                    <div className="flex items-center gap-1">
                      {p.owner ? (
                        <AvatarChip initials={p.owner.avatarInitials} name={p.owner.fullName} showName={false} size="sm" />
                      ) : (
                        <div className="flex -space-x-1">
                          {teamUsers.slice(0, 5).map((u) => (
                            <AvatarChip key={u.id} initials={u.avatarInitials} name={u.fullName} showName={false} size="xs" onClick={() => handleAssign(p.id, u.id)} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Status badge */}
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase border ${STATUS_COLORS[p.status] ?? STATUS_COLORS.A_ENVOYER}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-1.5 pt-3 border-t border-gray-50">
                    <Link href={`/admin/prospecting/${p.id}`} className="p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="View">
                      <HiOutlineEye className="w-4 h-4" />
                    </Link>
                    <button onClick={() => handleSend(p)} className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="WhatsApp">
                      <FaWhatsapp className="w-4 h-4" />
                    </button>
                    {p.instagram && (
                      <button onClick={() => handleSend(p)} className="p-2 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Instagram DM">
                        <FaInstagram className="w-4 h-4" />
                      </button>
                    )}
                    <Link href={`/admin/prospecting/${p.id}`} className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Notes">
                      <HiOutlineChatBubbleLeft className="w-4 h-4" />
                    </Link>
                    {canFollowUp && (
                      <button onClick={() => handleFollowUp(p)} className="p-2 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Follow up">
                        <HiOutlinePaperAirplane className="w-4 h-4" />
                      </button>
                    )}
                    {p.status !== "REPONDU" && p.status !== "CONVERTI" && (
                      <button onClick={() => handleMarkReplied(p)} className="ml-auto px-2.5 py-1 rounded-lg text-[11px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors" title="Mark replied">
                        ✓ Replied
                      </button>
                    )}
                    <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/admin/prospecting/${p.id}/edit`} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors" title="Edit">
                        <HiOutlinePencilSquare className="w-3.5 h-3.5" />
                      </Link>
                      <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                        <HiOutlineTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex justify-center gap-1.5 mt-8">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => navigate(statusFilter, sectorFilter, ownerFilter, p)} className={`w-9 h-9 rounded-xl text-[13px] font-medium transition-all ${p === pageParam ? "bg-gray-900 text-white" : "bg-white text-gray-500 border border-gray-100 hover:border-gray-300"}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
