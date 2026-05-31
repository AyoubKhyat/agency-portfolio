"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Upload, Send, CheckCircle, PhoneOff, Pencil, Trash2, Phone, LayoutGrid, List, Target } from "lucide-react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import { PageHeader } from "@/components/admin/page-header";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { Badge } from "@/components/admin/badge";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils";

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
    (ig, f) => `Bonjour,${ig ? ` je viens de découvrir @${ig}${f} et wow, le niveau est là !` : ""} Je suis Ayoub d'Ibda3 Digital, on crée des sites web sur mesure pour les salons beauté. Galerie, réservation, avis clientes — tout pour convertir vos abonnées en clientes. Un petit aperçu : https://ibda3-digital.vercel.app`,
  ],
  "Salle de Sport": [
    (ig, f) => `Salam ! Ayoub d'Ibda3 Digital ici.${ig ? ` J'ai vu votre salle sur @${ig}${f}, elle a l'air top !` : ""} Question rapide : vos futurs adhérents peuvent s'inscrire en ligne ? Un site avec planning des cours, tarifs et inscription pourrait vous amener du monde. Notre portfolio : https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour ! Je suis développeur web à Marrakech.${ig ? ` Votre compte @${ig}${f} montre une super ambiance dans votre salle.` : ""} Aujourd'hui les gens comparent les salles de sport en ligne avant de se déplacer — un site moderne fait toute la différence. Voici ce qu'on fait : https://ibda3-digital.vercel.app`,
    (ig, f) => `Hey ! Ayoub ici, agence Ibda3 Digital.${ig ? ` J'ai vu @${ig}${f}, belle énergie !` : ""} On aide des salles de sport à avoir une vraie présence web — planning, tarifs, inscription en ligne, tout ça bien présenté. Ça vous parle ? https://ibda3-digital.vercel.app`,
  ],
  "Immobilier": [
    (ig, f) => `Bonjour ! Ayoub d'Ibda3 Digital ici.${ig ? ` J'ai vu votre activité sur @${ig}${f}.` : ""} Un site immobilier avec recherche par quartier, fiches bien détaillées et contact WhatsApp intégré peut vraiment booster vos ventes. Intéressé ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Salam !${ig ? ` J'ai découvert votre agence via @${ig}${f}.` : ""} Je suis développeur web à Marrakech. La plupart des acheteurs commencent leur recherche en ligne — un site pro avec vos annonces vous donnerait un avantage sur la concurrence. Voici ce qu'on fait : https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour,${ig ? ` je suis passé sur @${ig}${f}, belles annonces !` : ""} Je suis Ayoub d'Ibda3 Digital. On crée des sites immobiliers modernes — catalogue de biens, filtres, localisation, tout intégré. Un échange rapide ? https://ibda3-digital.vercel.app`,
  ],
  "Centre de Formation": [
    (ig, f) => `Bonjour ! Ayoub d'Ibda3 Digital ici.${ig ? ` J'ai vu votre centre sur @${ig}${f}.` : ""} Un site web avec vos formations, planning, tarifs et inscription en ligne pourrait vous apporter des étudiants qui cherchent sur Google. Notre portfolio : https://ibda3-digital.vercel.app`,
    (ig, f) => `Salam !${ig ? ` Belle présence sur @${ig}${f} !` : ""} Je suis développeur web à Marrakech. Les parents et étudiants cherchent de plus en plus les formations en ligne — un site pro avec inscription vous démarquerait. On en discute ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour,${ig ? ` j'ai découvert @${ig}${f}, super concept !` : ""} Je suis Ayoub d'Ibda3 Digital. Un site avec vos programmes, témoignages et réservation en ligne ferait passer votre centre au niveau supérieur. Voici notre travail : https://ibda3-digital.vercel.app`,
  ],
  "Garage Auto": [
    (ig, f) => `Salam ! Je suis Ayoub d'Ibda3 Digital.${ig ? ` J'ai vu votre garage sur @${ig}${f}, beau travail !` : ""} Un site web avec vos services, tarifs et prise de RDV en ligne pourrait vous ramener des clients qui cherchent "garage Marrakech" sur Google. On en parle ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour !${ig ? ` @${ig}${f}, les réalisations sont propres !` : ""} Je suis développeur web à Marrakech. Quand quelqu'un cherche un garage de confiance, il va sur Google. Un site pro vous positionnerait en premier. Voici ce qu'on fait : https://ibda3-digital.vercel.app`,
  ],
  "Bijouterie": [
    (ig, f) => `Bonjour ! Ayoub d'Ibda3 Digital ici.${ig ? ` Vos créations sur @${ig}${f} sont splendides !` : ""} Un site vitrine avec galerie de vos bijoux, prix et commande en ligne pourrait attirer une clientèle premium. On en discute ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Salam !${ig ? ` J'ai vu @${ig}${f}, quel savoir-faire !` : ""} Je suis développeur web à Marrakech. Les clients qui cherchent "bijouterie Marrakech" sur Google méritent de tomber sur un beau site avec vos pièces. On peut créer ça : https://ibda3-digital.vercel.app`,
  ],
  "Agence de Voyage": [
    (ig, f) => `Bonjour ! Ayoub d'Ibda3 Digital ici.${ig ? ` J'ai vu vos excursions sur @${ig}${f}, ça donne envie !` : ""} Les touristes réservent en ligne avant même d'arriver — un site avec vos circuits, photos et réservation directe vous éviterait les commissions. On en parle ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Salam !${ig ? ` Belle page @${ig}${f} !` : ""} Je suis développeur web à Marrakech. Quand un touriste tape "excursion Marrakech" sur Google, est-ce qu'il vous trouve ? Un site optimisé SEO règle ça. Voici ce qu'on fait : https://ibda3-digital.vercel.app`,
  ],
  "Clinique / Cabinet Médical": [
    (ig, f) => `Bonjour Docteur ! Ayoub d'Ibda3 Digital ici.${ig ? ` J'ai vu votre clinique sur @${ig}${f}.` : ""} Un site avec vos spécialités, équipe médicale et prise de RDV en ligne rassure les patients et en attire de nouveaux. Voici notre portfolio : https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour,${ig ? ` j'ai découvert @${ig}${f}, belle structure !` : ""} Je suis développeur web à Marrakech. Les patients cherchent "clinique Marrakech" sur Google — un site pro vous positionne en premier. On en parle ? https://ibda3-digital.vercel.app`,
  ],
  "Centre de Langues": [
    (ig, f) => `Bonjour ! Ayoub d'Ibda3 Digital ici.${ig ? ` J'ai vu votre centre sur @${ig}${f}.` : ""} Un site avec vos cours, niveaux, planning et inscription en ligne pourrait vous apporter des élèves qui cherchent sur Google. Voici notre travail : https://ibda3-digital.vercel.app`,
    (ig, f) => `Salam !${ig ? ` Belle page @${ig}${f} !` : ""} Je suis développeur web à Marrakech. Les étudiants et expatriés cherchent "cours allemand Marrakech" ou "centre de langues Marrakech" en ligne — un site pro vous donnerait un avantage. On en discute ? https://ibda3-digital.vercel.app`,
  ],
  "Décoration / Meubles": [
    (ig, f) => `Bonjour ! Ayoub d'Ibda3 Digital ici.${ig ? ` Votre showroom sur @${ig}${f} est magnifique !` : ""} Un site e-commerce ou catalogue en ligne avec vos créations pourrait attirer des clients au-delà de Marrakech. On en discute ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Salam !${ig ? ` J'ai vu @${ig}${f}, vos meubles sont superbes !` : ""} Je suis développeur web à Marrakech. Un site avec catalogue, filtres par style et demande de devis pourrait booster vos ventes. Voici notre travail : https://ibda3-digital.vercel.app`,
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

const STATUSES = ["ALL", "A_ENVOYER", "ENVOYE", "REPONDU", "PAS_DE_WHATSAPP", "CONVERTI"] as const;
const STATUS_LABELS: Record<string, string> = { ALL: "All", A_ENVOYER: "To send", ENVOYE: "Sent", REPONDU: "Replied", PAS_DE_WHATSAPP: "No WA", CONVERTI: "Converted" };
const STATUS_BADGE: Record<string, string> = { A_ENVOYER: "blue", ENVOYE: "amber", REPONDU: "green", PAS_DE_WHATSAPP: "red", CONVERTI: "purple" };
const PRIORITY_BADGE: Record<number, string> = { 1: "green", 2: "amber", 3: "default" };
const PRIORITY_LABELS: Record<number, string> = { 1: "IG no site", 2: "No site", 3: "Has site" };
const SECTORS = [
  "ALL", "Dentiste", "Salon Beauté", "Salle de Sport", "Avocat",
  "Architecte/Décorateur", "Immobilier", "Restaurant/Café",
  "Patisserie", "Boulangerie", "Riad/Maison d'hôtes",
  "Photographe/Vidéaste", "Traiteur", "Spa/Hammam",
  "Coach Sportif", "Centre de Formation", "Garage Auto",
  "Décoration / Meubles", "Boutique Mode", "Bijouterie",
  "Agence de Voyage", "Clinique / Cabinet Médical",
  "Centre de Langues",
];

type Prospect = {
  id: string; name: string; phone: string; whatsappLink: string;
  sector: string; neighborhood: string; instagram: string;
  hasWebsite: boolean; priority: number; status: string;
  sentAt: string | null; createdAt: string;
  notes: { id: string; content: string; createdAt: string }[];
};

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

function isLandline(phone: string) {
  const d = phone?.replace(/\D/g, "") || "";
  return /^0?524/.test(d) || /^212524/.test(d);
}

function openLink(url: string) {
  const a = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

export default function ProspectingPage() {
  return (
    <Suspense fallback={<div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-20 rounded-xl" />)}</div>}>
      <ProspectingContent />
    </Suspense>
  );
}

function ProspectingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "ALL";
  const sectorFilter = searchParams.get("sector") ?? "ALL";
  const pageParam = parseInt(searchParams.get("page") ?? "1", 10);

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (statusFilter !== "ALL") qs.set("status", statusFilter);
    if (sectorFilter !== "ALL") qs.set("sector", sectorFilter);
    qs.set("page", String(pageParam));
    fetch(`/api/admin/prospecting?${qs}`)
      .then((r) => { if (r.status === 401) { router.push("/admin/login"); return null; } return r.json(); })
      .then((data) => { if (data) { setProspects(data.prospects); setTotal(data.total); setPages(data.pages); } setLoading(false); });
  }, [statusFilter, sectorFilter, pageParam, router]);

  function navigate(status: string, sector: string, page = 1) {
    const qs = new URLSearchParams();
    if (status !== "ALL") qs.set("status", status);
    if (sector !== "ALL") qs.set("sector", sector);
    if (page > 1) qs.set("page", String(page));
    router.push(`/admin/prospecting${qs.toString() ? `?${qs}` : ""}`);
  }

  async function handleSend(p: Prospect) {
    const noteContent = p.notes?.[0]?.content || "";
    const msg = getPersonalizedMessage(p, noteContent);
    const digits = p.phone?.replace(/\D/g, "") || "";
    const landline = isLandline(p.phone);

    if (digits && !landline) {
      let phone = digits;
      if (phone.startsWith("0")) phone = "212" + phone.slice(1);
      else if (!phone.startsWith("212") && !phone.startsWith("33")) phone = "212" + phone;
      openLink(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
    } else if (p.instagram) {
      const handle = p.instagram.replace(/^@/, "");
      navigator.clipboard.writeText(msg).catch(() => {});
      setCopied(p.id); setTimeout(() => setCopied(null), 3000);
      openLink(`https://ig.me/m/${handle}`);
    } else if (digits && landline) {
      navigator.clipboard.writeText(msg).catch(() => {});
      alert("Numéro fixe — message copié ! Appelez le " + p.phone);
      return;
    } else {
      alert("No phone or Instagram for this prospect."); return;
    }

    if (p.status === "A_ENVOYER" || p.status === "PAS_DE_WHATSAPP") {
      const res = await fetch(`/api/admin/prospecting/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ENVOYE" }) });
      if (res.ok) setProspects((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, status: "ENVOYE", sentAt: new Date().toISOString() } : pr));
    }
  }

  async function handleFollowUp(p: Prospect) {
    const msg = getFollowupMessage(p);
    const digits = p.phone?.replace(/\D/g, "") || "";
    const landline = isLandline(p.phone);
    if (digits && !landline) {
      let phone = digits;
      if (phone.startsWith("0")) phone = "212" + phone.slice(1);
      else if (!phone.startsWith("212") && !phone.startsWith("33")) phone = "212" + phone;
      openLink(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
    } else if (p.instagram) {
      const handle = p.instagram.replace(/^@/, "");
      navigator.clipboard.writeText(msg).catch(() => {});
      openLink(`https://ig.me/m/${handle}`);
    } else { return; }
    await fetch(`/api/admin/prospecting/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ENVOYE" }) }).catch(() => {});
    setProspects((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, status: "ENVOYE", sentAt: new Date().toISOString() } : pr));
  }

  async function handleMarkReplied(p: Prospect) {
    await fetch(`/api/admin/prospecting/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "REPONDU" }) });
    setProspects((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, status: "REPONDU" } : pr));
  }

  async function handleMarkNoWhatsApp(p: Prospect) {
    await fetch(`/api/admin/prospecting/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PAS_DE_WHATSAPP" }) });
    setProspects((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, status: "PAS_DE_WHATSAPP" } : pr));
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete prospect "${name}"?`)) return;
    const res = await fetch(`/api/admin/prospecting/${id}`, { method: "DELETE" });
    if (res.ok) setProspects((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true);
    const formData = new FormData(); formData.append("file", file);
    const res = await fetch("/api/admin/prospecting/import", { method: "POST", body: formData });
    const data = await res.json(); setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.ok) { alert(`Imported ${data.imported} prospects.${data.errors?.length ? `\n\nErrors:\n${data.errors.join("\n")}` : ""}`); navigate(statusFilter, sectorFilter, 1); }
    else { alert(`Import failed: ${data.error}`); }
  }

  function getSendStyle(p: Prospect) {
    const d = p.phone?.replace(/\D/g, "") || "";
    const land = isLandline(p.phone);
    if (d && !land) return { color: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100", icon: <FaWhatsapp className="w-3.5 h-3.5" />, label: "WA" };
    if (p.instagram) return { color: "bg-purple-50 text-purple-600 hover:bg-purple-100", icon: <FaInstagram className="w-3.5 h-3.5" />, label: "IG" };
    if (d && land) return { color: "bg-amber-50 text-amber-600 hover:bg-amber-100", icon: <Phone className="w-3.5 h-3.5" />, label: "Call" };
    return { color: "bg-zinc-500/15 text-gray-400", icon: <Send className="w-3.5 h-3.5" />, label: "—" };
  }

  const canFollowUp = (p: Prospect) => p.status === "ENVOYE" && p.sentAt && (Date.now() - new Date(p.sentAt).getTime()) > 3 * 86400000;

  return (
    <div>
      <PageHeader
        title="Prospecting"
        count={total}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-50 border border-[var(--os-border)] rounded-lg p-0.5">
              <button onClick={() => setView("list")} className={cn("p-1.5 rounded-md transition-colors", view === "list" ? "bg-purple-50 text-purple-600" : "text-gray-500 hover:text-gray-800")}>
                <List className="w-4 h-4" />
              </button>
              <button onClick={() => setView("grid")} className={cn("p-1.5 rounded-md transition-colors", view === "grid" ? "bg-purple-50 text-purple-600" : "text-gray-500 hover:text-gray-800")}>
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={importing} className="flex items-center gap-2 px-3 py-2 border border-[var(--os-border)] hover:border-[var(--os-border-hover)] rounded-lg text-sm text-gray-600 hover:text-gray-900 transition-all disabled:opacity-50">
              <Upload className="w-4 h-4" /> {importing ? "..." : "CSV"}
            </button>
            <Link href="/admin/prospecting/new" className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> New
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <FilterTabs
        items={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] || s }))}
        active={statusFilter}
        onChange={(v) => navigate(v, sectorFilter)}
        className="mb-2"
      />
      <FilterTabs
        items={SECTORS.map((s) => ({ value: s, label: s === "ALL" ? "All sectors" : s }))}
        active={sectorFilter}
        onChange={(v) => navigate(statusFilter, v)}
        className="mb-6"
        scrollable
      />

      {loading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="os-skeleton h-14 rounded-lg" />)}</div>
      ) : prospects.length === 0 ? (
        <EmptyState icon={<Target className="w-6 h-6" />} title="No prospects found" description="Try changing filters or add new prospects." />
      ) : view === "list" ? (
        <>
          <div className="border border-[var(--os-border)] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--os-border)] bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-[11px] uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-[11px] uppercase tracking-wider">Sector</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-[11px] uppercase tracking-wider">Location</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-[11px] uppercase tracking-wider">Priority</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-[11px] uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-[11px] uppercase tracking-wider">Sent</th>
                  <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-[11px] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => {
                  const ss = getSendStyle(p);
                  return (
                    <tr key={p.id} className="border-b border-[var(--os-border)] hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link href={`/admin/prospecting/${p.id}`} className="text-gray-900 font-medium text-[13px] hover:text-purple-600 transition-colors">{p.name}</Link>
                        {p.instagram && <span className="ml-1.5 text-[11px] text-gray-400">@{p.instagram.replace(/^@/, "")}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{p.sector}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{p.neighborhood || "—"}</td>
                      <td className="px-4 py-2.5"><Badge variant={PRIORITY_BADGE[p.priority] as "green" | "amber" | "default"} size="sm">{PRIORITY_LABELS[p.priority]}</Badge></td>
                      <td className="px-4 py-2.5"><Badge variant={STATUS_BADGE[p.status] as "blue" | "amber" | "green" | "red" | "purple"} size="sm" dot>{STATUS_LABELS[p.status]}</Badge></td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{p.sentAt ? new Date(p.sentAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {canFollowUp(p) && (
                            <button onClick={() => handleFollowUp(p)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors" title="Follow up">
                              <Send className="w-3 h-3" /> Follow up
                            </button>
                          )}
                          <button onClick={() => handleSend(p)} className={cn("flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors", ss.color)} title="Send">
                            {ss.icon} {copied === p.id ? "Copied!" : ss.label}
                          </button>
                          {p.status !== "REPONDU" && p.status !== "CONVERTI" && (
                            <button onClick={() => handleMarkReplied(p)} className="p-1 rounded-md text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Replied">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {p.status !== "PAS_DE_WHATSAPP" && (
                            <button onClick={() => handleMarkNoWhatsApp(p)} className="p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="No WA">
                              <PhoneOff className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <Link href={`/admin/prospecting/${p.id}/edit`} className="p-1 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors"><Pencil className="w-3.5 h-3.5" /></Link>
                          <button onClick={() => handleDelete(p.id, p.name)} className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex justify-center gap-1.5 mt-6">
              {Array.from({ length: pages }, (_, i) => i + 1).map((pg) => (
                <button key={pg} onClick={() => navigate(statusFilter, sectorFilter, pg)} className={cn("w-8 h-8 rounded-lg text-xs font-medium transition-colors", pg === pageParam ? "bg-purple-500 text-white" : "text-gray-500 hover:bg-gray-100")}>{pg}</button>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Grid View */
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {prospects.map((p, i) => {
              const ss = getSendStyle(p);
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.02 }}
                  className="group rounded-xl border border-[var(--os-border)] bg-white/80 p-4 hover:border-[var(--os-border-hover)] hover:bg-white/80 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <Link href={`/admin/prospecting/${p.id}`} className="text-[14px] font-semibold text-gray-900 hover:text-purple-600 transition-colors truncate">{p.name}</Link>
                    <Badge variant={STATUS_BADGE[p.status] as "blue" | "amber" | "green" | "red" | "purple"} size="sm" dot>{STATUS_LABELS[p.status]}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="default" size="sm">{p.sector}</Badge>
                    {p.neighborhood && <span className="text-[11px] text-gray-400">{p.neighborhood}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-3">
                    {p.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>}
                    {p.instagram && <span className="flex items-center gap-1"><FaInstagram className="w-3 h-3" />@{p.instagram.replace(/^@/, "")}</span>}
                  </div>
                  <div className="flex items-center gap-1 pt-2 border-t border-[var(--os-border)]">
                    {canFollowUp(p) && (
                      <button onClick={() => handleFollowUp(p)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors">
                        <Send className="w-3 h-3" /> Follow up
                      </button>
                    )}
                    <button onClick={() => handleSend(p)} className={cn("flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors", ss.color)}>
                      {ss.icon} {copied === p.id ? "Copied!" : ss.label}
                    </button>
                    {p.status !== "REPONDU" && p.status !== "CONVERTI" && (
                      <button onClick={() => handleMarkReplied(p)} className="p-1 rounded-md text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Replied"><CheckCircle className="w-3.5 h-3.5" /></button>
                    )}
                    <div className="ml-auto flex gap-0.5">
                      <Link href={`/admin/prospecting/${p.id}/edit`} className="p-1 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors"><Pencil className="w-3.5 h-3.5" /></Link>
                      <button onClick={() => handleDelete(p.id, p.name)} className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {pages > 1 && (
            <div className="flex justify-center gap-1.5 mt-6">
              {Array.from({ length: pages }, (_, i) => i + 1).map((pg) => (
                <button key={pg} onClick={() => navigate(statusFilter, sectorFilter, pg)} className={cn("w-8 h-8 rounded-lg text-xs font-medium transition-colors", pg === pageParam ? "bg-purple-500 text-white" : "text-gray-500 hover:bg-gray-100")}>{pg}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
