"use client";

import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Upload, Send, CheckCircle, PhoneOff, Pencil, Trash2, Phone, LayoutGrid, List, Target, Search, X, Zap, ArrowUpDown, ShieldCheck, ShieldAlert, FileQuestion, MoreHorizontal, ArrowRight, Archive, MessageCircleQuestion, ExternalLink } from "lucide-react";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";
import { PageHeader } from "@/components/admin/page-header";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { Badge } from "@/components/admin/badge";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/admin/empty-state";
import { ProspectDrawer } from "@/components/admin/prospect-drawer";
import { SendConfirm } from "@/components/admin/send-confirm";
import { browserToday, recordConfirmedSend, type NextFollowUp } from "@/lib/lead-actions";
import type { SendChannel } from "@/lib/next-action";
import { cn } from "@/lib/utils";
import { PROSPECT_SEGMENTS, SEGMENT_LABELS, SEGMENT_TOKENS, type ProspectSegment } from "@/lib/prospect-segments";
import { stageForStatusParam, getChannelState, CHANNEL_LABELS } from "@/lib/prospect-stages";
import {
  VISIBLE_GROUPS, VISIBLE_SEND_LABELS, REPLY_LABELS, LEGACY_EVIDENCE_LABELS, getDisplayGroupByKey,
  displayStageOf, isLegacyEvidenceParam, showsSendEvidence,
  type DisplayGroupKey, type RowSummary, type VisibleSendEvidence,
} from "@/lib/prospect-groups";

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

const STATUSES = ["ALL", "A_ENVOYER", "ENVOYE", "REPONDU", "MEETING", "PROPOSAL_SENT", "NEGOTIATION", "PAS_DE_WHATSAPP", "CLIENT", "CONVERTI", "LOST"] as const;
const STATUS_LABELS: Record<string, string> = { ALL: "All", A_ENVOYER: "To send", ENVOYE: "Sent", REPONDU: "Replied", MEETING: "Meeting", PROPOSAL_SENT: "Proposal", NEGOTIATION: "Negotiation", PAS_DE_WHATSAPP: "No WA", CLIENT: "Client", CONVERTI: "Converted", LOST: "Lost" };
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
  hasWebsite: boolean; whatsappStatus: string; instagramStatus: string;
  priority: number; status: string;
  segment: ProspectSegment;
  email?: string | null; website?: string | null;
  qualityLabel?: "HOT" | "WARM" | "COLD" | null;
  sentAt: string | null; createdAt: string;
  followUpDate: string | null;
  ownerUserId: string | null;
  sentByName: string | null;
  lastActionByName: string | null;
  lastActionAt: string | null;
  proposalAmount: number | null;
  proposalStatus: string | null;
  contactedAt: string | null;
  score: number | null;
  scoreLabel: string | null;
  scoredAt: string | null;
  owner?: { id: string; fullName: string; avatarInitials: string } | null;
  notes: { id: string; content: string; authorName: string | null; createdAt: string }[];
  /** Latest send record (outreach message or SENT_WHATSAPP / SENT_INSTAGRAM activity), if any. */
  lastSendAt?: string | null;
  /** Stricter evidence (confirmed outreach message since 2026-08-20), worked out by the server. */
  sendEvidence?: VisibleSendEvidence;
  /** Group, next action and reply state, from the lead queue's own rules. Null if not available. */
  summary?: RowSummary | null;
};

type OwnerStat = { id: string; fullName: string; avatarInitials: string; count: number };

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

function getHealthScore(p: { phone: string; instagram: string; hasWebsite: boolean; status: string; followUpDate: string | null }): { score: number; label: string; color: string } {
  let score = 0;
  if (p.phone && !isLandline(p.phone)) score += 20;
  if (p.instagram) score += 15;
  if (p.hasWebsite) score += 15;
  if (p.status === "REPONDU" || p.status === "MEETING" || p.status === "NEGOTIATION") score += 20;
  if (p.status === "CLIENT" || p.status === "CONVERTI") score += 30;
  if (p.followUpDate) score += 10;
  score = Math.min(score, 100);
  if (score >= 60) return { score, label: "Hot", color: "bg-emerald-100 os-dark:bg-emerald-500/15 text-emerald-700 os-dark:text-emerald-300" };
  if (score >= 30) return { score, label: "Warm", color: "bg-amber-100 os-dark:bg-amber-500/15 text-amber-700 os-dark:text-amber-300" };
  return { score, label: "Cold", color: "bg-red-100 os-dark:bg-red-500/15 text-red-700 os-dark:text-red-300" };
}

function openLink(url: string) {
  const a = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

export default function ProspectingPage() {
  return (
    <Suspense fallback={<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">{[...Array(4)].map((_, i) => <div key={i} className="os-skeleton h-20 rounded-xl" />)}</div>}>
      <ProspectingContent />
    </Suspense>
  );
}

function ScoreBadge({ prospect, factors }: { prospect: Prospect; factors?: string[] }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const score = prospect.score;
  const label = prospect.scoreLabel;

  if (score == null || !label) {
    return <span className="text-[10px] text-[var(--os-text-faint)] italic">--</span>;
  }

  const colorMap: Record<string, string> = {
    Hot: "bg-red-100 os-dark:bg-red-500/15 text-red-700 os-dark:text-red-300 border-red-200 os-dark:border-red-500/30",
    Warm: "bg-orange-100 os-dark:bg-orange-500/15 text-orange-700 os-dark:text-orange-300 border-orange-200 os-dark:border-orange-500/30",
    Cold: "bg-blue-100 os-dark:bg-blue-500/15 text-blue-700 os-dark:text-blue-300 border-blue-200 os-dark:border-blue-500/30",
  };

  const dotColor: Record<string, string> = {
    Hot: "bg-red-500",
    Warm: "bg-orange-500",
    Cold: "bg-blue-500",
  };

  return (
    <div className="relative inline-flex">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => { e.stopPropagation(); setShowTooltip(!showTooltip); }}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-help",
          colorMap[label] || "bg-gray-100 os-dark:bg-[var(--os-hover)] text-gray-600 os-dark:text-[var(--os-text-muted)] border-gray-200 os-dark:border-[var(--os-border)]"
        )}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full", dotColor[label] || "bg-gray-400")} />
        {score} {label}
      </button>
      {showTooltip && factors && factors.length > 0 && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[var(--os-surface)] rounded-lg shadow-lg border border-[var(--os-control-border)] p-2.5 text-left">
          <div className="text-[11px] font-semibold text-[var(--os-text)] mb-1.5">Score Breakdown</div>
          <ul className="space-y-0.5">
            {factors.map((f, i) => (
              <li key={i} className="text-[10px] text-[var(--os-text-muted)] flex items-start gap-1">
                <span className="text-[var(--os-text-faint)] mt-0.5">&#8226;</span>
                {f}
              </li>
            ))}
          </ul>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-[var(--os-surface)] border-r border-b border-[var(--os-control-border)] rotate-45" />
        </div>
      )}
    </div>
  );
}

/**
 * Simple stage badge; the detailed stored status stays visible on hover. A recorded
 * reply shows "Replied" rather than a stage that contradicts it (display only).
 */
function StageBadge({ prospect }: { prospect: Prospect }) {
  const status = prospect.status;
  const stage = displayStageOf({ status, messageReplied: prospect.summary?.replyState === "CONFIRMED" });
  return (
    <span title={`Detailed status: ${STATUS_LABELS[status] ?? status}`}>
      <Badge variant={stage?.badge ?? "default"} size="sm" dot>{stage?.label ?? (STATUS_LABELS[status] ?? status)}</Badge>
    </span>
  );
}

/** Contact channel: can this prospect be reached? Says nothing about whether a message was sent. */
function ChannelChip({ prospect }: { prospect: Prospect }) {
  const state = getChannelState(prospect);
  const meta = CHANNEL_LABELS[state];
  const verified = state === "VERIFIED";
  return (
    <span title={meta.title} className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border",
      verified ? "bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-700 os-dark:text-emerald-300 border-emerald-100 os-dark:border-emerald-500/30" : "bg-slate-50 os-dark:bg-[var(--os-surface-2)] text-slate-500 os-dark:text-[var(--os-text-soft)] border-slate-200 os-dark:border-[var(--os-border)]",
    )}>
      {verified ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
      {meta.label}
    </span>
  );
}

/** Send evidence, stricter rule: only a message someone confirmed (since 20 Aug 2026) counts as sent. */
function SendChip({ prospect }: { prospect: Prospect }) {
  const evidence = prospect.sendEvidence;
  if (!evidence || evidence === "NOT_CONTACTED") return null;
  const meta = VISIBLE_SEND_LABELS[evidence];
  const confirmed = evidence === "CONFIRMED";
  return (
    <span title={meta.title} className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border",
      confirmed ? "bg-blue-50 os-dark:bg-blue-500/10 text-blue-700 os-dark:text-blue-300 border-blue-100 os-dark:border-blue-500/30" : "bg-amber-50 os-dark:bg-amber-500/10 text-amber-800 os-dark:text-amber-300 border-amber-100 os-dark:border-amber-500/30",
    )}>
      {confirmed ? <Send className="w-3 h-3" /> : <FileQuestion className="w-3 h-3" />}
      {meta.label}
    </span>
  );
}

/** A recorded reply, or a possible old one that still needs checking. */
function ReplyChip({ prospect }: { prospect: Prospect }) {
  const state = prospect.summary?.replyState;
  if (!state || state === "NONE") return null;
  const meta = REPLY_LABELS[state];
  return (
    <span title={meta.title} className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border",
      state === "CONFIRMED" ? "bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-700 os-dark:text-emerald-300 border-emerald-100 os-dark:border-emerald-500/30" : "bg-slate-50 os-dark:bg-[var(--os-surface-2)] text-slate-600 os-dark:text-[var(--os-text-muted)] border-slate-200 os-dark:border-[var(--os-border)]",
    )}>
      {state === "CONFIRMED" ? <CheckCircle className="w-3 h-3" /> : <MessageCircleQuestion className="w-3 h-3" />}
      {meta.label}
    </span>
  );
}

/** The evidence badges, in one place for the three views. */
function Chips({ prospect }: { prospect: Prospect }) {
  return <><ChannelChip prospect={prospect} />{showsSendEvidence(prospect.summary?.group) && <SendChip prospect={prospect} />}<ReplyChip prospect={prospect} /></>;
}

function ProspectingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "ALL";
  const sectorFilter = searchParams.get("sector") ?? "ALL";
  const ownerFilter = searchParams.get("owner") ?? "ALL";
  const qualityFilter = searchParams.get("qualityLabel") ?? "ALL";
  const segmentFilter = searchParams.get("segment") ?? "ALL";
  const dueFilter = searchParams.get("due") ?? "ALL";
  const channelFilter = searchParams.get("channel") ?? "ALL";
  const evidenceFilter = searchParams.get("evidence") ?? "ALL";
  const pageParam = parseInt(searchParams.get("page") ?? "1", 10);
  // Display group tab. Old status= / due= links keep their exact meaning and show no group;
  // a plain visit opens New Leads.
  const groupParam = getDisplayGroupByKey(searchParams.get("group"))?.key ?? null;
  // An older evidence= value (recorded, legacy, none, unbacked) is a global filter, as before groups.
  const legacyEvidence = isLegacyEvidenceParam(evidenceFilter);
  const groupFilter: DisplayGroupKey | null = groupParam ?? (statusFilter === "ALL" && dueFilter === "ALL" && !legacyEvidence ? "NEW_LEADS" : null);

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");
  const [copied, setCopied] = useState<string | null>(null);
  const [pendingSend, setPendingSend] = useState<{ prospect: Prospect; channel: SendChannel; kind: "first" | "follow_up"; body: string } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [ownerStats, setOwnerStats] = useState<OwnerStat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [drawerProspectId, setDrawerProspectId] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [sortByScore, setSortByScore] = useState(false);
  const [scoreFactors, setScoreFactors] = useState<Record<string, string[]>>({});
  const [groupCounts, setGroupCounts] = useState<Record<DisplayGroupKey, number> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const reload = () => setReloadKey((k) => k + 1);
  const [kpis, setKpis] = useState<{ warmRelationships: number; agencyOpportunities: number; luxuryBrands: number; legacyCold: number; meetingsScheduled: number; proposalValue: number; pipelineValue: number; clientsWon: number; upcomingFollowups: number; overdueFollowups: number; currency: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }

  useEffect(() => {
    fetch("/api/admin/team-stats").then((r) => r.ok ? r.json() : []).then((stats: { user: { id: string; fullName: string; avatarInitials: string }; assigned: number }[]) => {
      setOwnerStats(stats.map((s) => ({ id: s.user.id, fullName: s.user.fullName, avatarInitials: s.user.avatarInitials, count: s.assigned })));
    }).catch(() => {});
    fetch("/api/admin/prospecting/kpis").then((r) => r.ok ? r.json() : null).then((d) => { if (d) setKpis(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (statusFilter !== "ALL") qs.set("status", statusFilter);
    if (sectorFilter !== "ALL") qs.set("sector", sectorFilter);
    if (qualityFilter !== "ALL") qs.set("qualityLabel", qualityFilter);
    if (segmentFilter !== "ALL") qs.set("segment", segmentFilter);
    if (dueFilter !== "ALL") qs.set("due", dueFilter);
    if (channelFilter !== "ALL") qs.set("channel", channelFilter);
    if (evidenceFilter !== "ALL") qs.set("evidence", evidenceFilter);
    if (ownerFilter !== "ALL" && ownerFilter !== "UNASSIGNED") qs.set("owner", ownerFilter);
    if (ownerFilter === "UNASSIGNED") qs.set("unassigned", "true");
    if (debouncedSearch.trim()) qs.set("search", debouncedSearch.trim());
    if (groupFilter) qs.set("group", groupFilter);
    qs.set("page", String(pageParam));
    fetch(`/api/admin/prospecting?${qs}`)
      .then((r) => { if (r.status === 401) { router.push("/admin/login"); return null; } return r.json(); })
      .then((data) => { if (data) { setProspects(data.prospects); setTotal(data.total); setPages(data.pages); setGroupCounts(data.groupCounts ?? null); } setLoading(false); });
  }, [statusFilter, sectorFilter, qualityFilter, segmentFilter, dueFilter, channelFilter, evidenceFilter, ownerFilter, debouncedSearch, pageParam, groupFilter, reloadKey, router]);

  /**
   * Same positional signature as before, plus the group. A detailed status or a due view
   * replaces the group (they kept their own meaning before groups existed).
   */
  function navigate(status: string, sector: string, page = 1, owner = ownerFilter, quality = qualityFilter, segment = segmentFilter, due = dueFilter, channel = channelFilter, evidence = evidenceFilter, group: DisplayGroupKey | null = groupFilter) {
    const qs = new URLSearchParams();
    if (status === "ALL" && due === "ALL" && group) qs.set("group", group);
    if (status !== "ALL") qs.set("status", status);
    if (sector !== "ALL") qs.set("sector", sector);
    if (quality !== "ALL") qs.set("qualityLabel", quality);
    if (segment !== "ALL") qs.set("segment", segment);
    if (due !== "ALL") qs.set("due", due);
    if (channel !== "ALL") qs.set("channel", channel);
    if (evidence !== "ALL") qs.set("evidence", evidence);
    if (owner !== "ALL") qs.set("owner", owner);
    if (page > 1) qs.set("page", String(page));
    router.push(`/admin/prospecting${qs.toString() ? `?${qs}` : ""}`);
  }

  // A send logged from this page is a new send record; the reload that follows refreshes the labels.
  function withSendRecord(pr: Prospect, actionType: string): Prospect {
    return actionType === "SENT_WHATSAPP" || actionType === "SENT_INSTAGRAM" ? { ...pr, lastSendAt: new Date().toISOString() } : pr;
  }

  function armSend(send: NonNullable<typeof pendingSend>) {
    setPendingSend(send);
    setSendError(null);
  }

  /** Opening a channel records nothing. The send is saved only if the user confirms it below. */
  async function confirmPendingSend(next?: NextFollowUp) {
    if (!pendingSend) return;
    const pending = pendingSend;
    const { prospect: p, channel, kind, body } = pending;
    const today = browserToday();
    const result = await recordConfirmedSend(fetch.bind(window), kind === "first"
      ? { kind: "first", prospectId: p.id, channel, body, today }
      : { kind: "follow_up", prospectId: p.id, channel, body, today, step: null, next: next ?? 3 });
    if (!result.ok && !result.recorded) { setSendError(result.error); return; }
    if (!result.ok) alert(result.error);
    const actionType = channel === "WHATSAPP" ? "SENT_WHATSAPP" : "SENT_INSTAGRAM";
    setProspects((prev) => prev.map((pr) => pr.id === p.id ? withSendRecord({ ...pr, status: pr.status === "A_ENVOYER" ? "ENVOYE" : pr.status }, actionType) : pr));
    setPendingSend((current) => (current === pending ? null : current)); // another prospect may have been opened meanwhile
    setSendError(null);
    reload(); // the group, evidence and next action come from the server
  }

  async function handleSendWA(p: Prospect) {
    const noteContent = p.notes?.[0]?.content || "";
    const msg = getPersonalizedMessage(p, noteContent);
    const digits = p.phone?.replace(/\D/g, "") || "";
    if (!digits) { alert("No phone number."); return; }
    const landline = isLandline(p.phone);
    if (landline) { navigator.clipboard.writeText(msg).catch(() => {}); alert("Numéro fixe — message copié ! Appelez le " + p.phone); return; }
    // Never open a WhatsApp link that hasn't been confirmed as reachable —
    // copy the message instead so the rep can send it after confirming.
    if (p.whatsappStatus !== "VERIFIED") {
      navigator.clipboard.writeText(msg).catch(() => {});
      alert("WhatsApp not confirmed for this prospect. Open it and use \"Confirm WhatsApp\" first — message copied to clipboard.");
      return;
    }
    let phone = digits;
    if (phone.startsWith("0")) phone = "212" + phone.slice(1);
    else if (!phone.startsWith("212") && !phone.startsWith("33")) phone = "212" + phone;
    openLink(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
    armSend({ prospect: p, channel: "WHATSAPP", kind: "first", body: msg });
  }

  async function handleSendIG(p: Prospect) {
    const noteContent = p.notes?.[0]?.content || "";
    const msg = getPersonalizedMessage(p, noteContent);
    if (!p.instagram) { alert("No Instagram."); return; }
    const handle = p.instagram.replace(/^@/, "");
    navigator.clipboard.writeText(msg).catch(() => {});
    setCopied(p.id); setTimeout(() => setCopied(null), 3000);
    // Only open the DM link once the handle has been confirmed to exist.
    if (p.instagramStatus !== "VERIFIED") {
      alert(`Instagram @${handle} not confirmed. Open the prospect and use "Confirm Instagram" first — message copied to clipboard.`);
      return;
    }
    openLink(`https://ig.me/m/${handle}`);
    armSend({ prospect: p, channel: "INSTAGRAM", kind: "first", body: msg });
  }

  async function handleSend(p: Prospect) {
    const digits = p.phone?.replace(/\D/g, "") || "";
    const landline = isLandline(p.phone);
    if (digits && !landline) { await handleSendWA(p); }
    else if (p.instagram) { await handleSendIG(p); }
    else if (digits && landline) { await handleSendWA(p); }
    else { alert("No phone or Instagram for this prospect."); }
  }

  /** "Send first message": the next action only offers it when a channel is confirmed, so use that one. */
  async function handleFirstMessage(p: Prospect) {
    const digits = p.phone?.replace(/\D/g, "") || "";
    if (p.whatsappStatus === "VERIFIED" && digits && !isLandline(p.phone)) return handleSendWA(p);
    if (p.instagramStatus === "VERIFIED" && p.instagram) return handleSendIG(p);
    return handleSend(p);
  }

  async function handleFollowUp(p: Prospect) {
    const msg = getFollowupMessage(p);
    const digits = p.phone?.replace(/\D/g, "") || "";
    const landline = isLandline(p.phone);
    if (digits && !landline && p.whatsappStatus === "VERIFIED") {
      let phone = digits;
      if (phone.startsWith("0")) phone = "212" + phone.slice(1);
      else if (!phone.startsWith("212") && !phone.startsWith("33")) phone = "212" + phone;
      openLink(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
      armSend({ prospect: p, channel: "WHATSAPP", kind: "follow_up", body: msg });
    } else if (p.instagram && p.instagramStatus === "VERIFIED") {
      const handle = p.instagram.replace(/^@/, "");
      navigator.clipboard.writeText(msg).catch(() => {});
      openLink(`https://ig.me/m/${handle}`);
      armSend({ prospect: p, channel: "INSTAGRAM", kind: "follow_up", body: msg });
    } else {
      // No verified channel — copy the follow-up so it can still be sent
      // manually after confirming, but never open a dead link.
      navigator.clipboard.writeText(msg).catch(() => {});
      alert("No confirmed WhatsApp/Instagram for this prospect. Follow-up message copied — confirm a channel on the prospect to enable one-click send.");
      return;
    }
  }

  async function handleMarkReplied(p: Prospect) {
    await fetch(`/api/admin/prospecting/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "REPONDU" }) });
    setProspects((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, status: "REPONDU" } : pr));
    reload();
  }

  async function handleMarkNoWhatsApp(p: Prospect) {
    await fetch(`/api/admin/prospecting/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PAS_DE_WHATSAPP" }) });
    setProspects((prev) => prev.map((pr) => pr.id === p.id ? { ...pr, status: "PAS_DE_WHATSAPP" } : pr));
    reload();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete prospect "${name}"?`)) return;
    const res = await fetch(`/api/admin/prospecting/${id}`, { method: "DELETE" });
    if (res.ok) { setProspects((prev) => prev.filter((p) => p.id !== id)); reload(); }
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

  async function handleScoreAll() {
    setScoring(true);
    try {
      const res = await fetch("/api/admin/prospecting/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        const data = await res.json();
        const factorsMap: Record<string, string[]> = {};
        const scoreMap: Record<string, { score: number; label: string }> = {};
        for (const p of data.prospects) {
          factorsMap[p.id] = p.factors;
          scoreMap[p.id] = { score: p.score, label: p.label };
        }
        setScoreFactors((prev) => ({ ...prev, ...factorsMap }));
        setProspects((prev) =>
          prev.map((pr) =>
            scoreMap[pr.id]
              ? { ...pr, score: scoreMap[pr.id].score, scoreLabel: scoreMap[pr.id].label, scoredAt: new Date().toISOString() }
              : pr
          )
        );
      }
    } catch {
      // silently fail
    }
    setScoring(false);
  }

  async function handleScoreOne(prospectId: string) {
    try {
      const res = await fetch("/api/admin/prospecting/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId }),
      });
      if (res.ok) {
        const data = await res.json();
        setScoreFactors((prev) => ({ ...prev, [data.id]: data.factors }));
        setProspects((prev) =>
          prev.map((pr) =>
            pr.id === data.id
              ? { ...pr, score: data.score, scoreLabel: data.label, scoredAt: new Date().toISOString() }
              : pr
          )
        );
      }
    } catch {
      // silently fail
    }
  }

  const displayedProspects = sortByScore
    ? [...prospects].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    : prospects;

  function getSendStyle(p: Prospect) {
    const d = p.phone?.replace(/\D/g, "") || "";
    const land = isLandline(p.phone);
    if (d && !land) return { color: "bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-600 os-dark:text-emerald-400 hover:bg-emerald-100 os-dark:hover:bg-emerald-500/15", icon: <FaWhatsapp className="w-3.5 h-3.5" />, label: "WA" };
    if (p.instagram) return { color: "bg-purple-50 os-dark:bg-purple-500/10 text-purple-600 os-dark:text-purple-400 hover:bg-purple-100 os-dark:hover:bg-purple-500/15", icon: <FaInstagram className="w-3.5 h-3.5" />, label: "IG" };
    if (d && land) return { color: "bg-amber-50 os-dark:bg-amber-500/10 text-amber-600 os-dark:text-amber-400 hover:bg-amber-100 os-dark:hover:bg-amber-500/15", icon: <Phone className="w-3.5 h-3.5" />, label: "Call" };
    return { color: "bg-zinc-500/15 text-[var(--os-text-soft)]", icon: <Send className="w-3.5 h-3.5" />, label: "—" };
  }

  const activeStage = stageForStatusParam(statusFilter);
  const advancedCount = [
    segmentFilter !== "ALL",
    statusFilter !== "ALL",
    evidenceFilter !== "ALL",
    sectorFilter !== "ALL",
    qualityFilter !== "ALL",
    ownerFilter !== "ALL",
    channelFilter !== "ALL",
  ].filter(Boolean).length;
  const canFollowUp = (p: Prospect) => p.status === "ENVOYE" && p.sentAt && (Date.now() - new Date(p.sentAt).getTime()) > 3 * 86400000;
  const legacyStatusLabel = statusFilter === "ALL" ? null
    : activeStage?.label ?? statusFilter.split(",").map((s) => STATUS_LABELS[s] ?? s).join(", ");
  const activeGroup = getDisplayGroupByKey(groupFilter);
  const showGroup = (key: DisplayGroupKey | null) => navigate("ALL", sectorFilter, 1, ownerFilter, qualityFilter, segmentFilter, "ALL", channelFilter, evidenceFilter, key);
  const pill = "text-[11.5px] px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all";
  const pillOff = "text-[var(--os-text-muted)] bg-[var(--os-surface)] border border-[var(--os-border)] hover:bg-gray-50 os-dark:hover:bg-[var(--os-surface-2)]";
  const pillOn = "bg-gradient-to-r from-[#8B00FF] to-[#C026D3] text-white shadow-sm";
  const rowLabel = "text-[10px] uppercase tracking-wider text-[var(--os-text-faint)] font-bold mr-1 w-[104px] shrink-0";

  /** The one primary step for a prospect, from the lead queue's rules. Quiet text when there is nothing to do. */
  function renderNextAction(p: Prospect) {
    const a = p.summary?.nextAction;
    if (!a) return <span className="text-[11px] text-[var(--os-text-faint)]">—</span>;
    if (!a.actionable) return <span title={a.hint} className="text-[12px] text-[var(--os-text-soft)]">{a.label}</span>;
    const primary = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-[#8B00FF] to-[#C026D3] hover:opacity-90 transition-all whitespace-nowrap";
    const onClick =
      a.key === "ready" ? () => handleFirstMessage(p)
      : a.key === "follow_up_overdue" || a.key === "follow_up_today" ? () => handleFollowUp(p)
      : null;
    if (onClick) {
      return <button type="button" onClick={onClick} title={a.hint} className={primary}><Send className="w-3.5 h-3.5" /> {a.label}</button>;
    }
    // Deciding on a follow-up lives in the focus mode; everything else is done on the prospect page.
    const href = a.key === "follow_up_decision" ? "/admin/lead-queue?view=followUps" : `/admin/prospecting/${p.id}`;
    return <Link href={href} title={a.hint} className={primary}>{a.label} <ArrowRight className="w-3.5 h-3.5" /></Link>;
  }

  /** The "more" toggle for every other action. Only one row's actions are open at a time. */
  // `where` keeps ids unique: the phone cards and the table are both in the page (one is hidden by CSS).
  function renderMenuButton(p: Prospect, where: "card" | "row") {
    const open = openMenuId === p.id;
    return (
      <button type="button" title="More actions" aria-expanded={open} aria-controls={`actions-${where}-${p.id}`}
        onClick={() => setOpenMenuId(open ? null : p.id)}
        className={cn("inline-flex p-1.5 rounded-md transition-colors", open ? "bg-gray-100 os-dark:bg-[var(--os-hover)] text-[var(--os-text)]" : "text-[var(--os-text-soft)] hover:text-[var(--os-text)] hover:bg-gray-100 os-dark:hover:bg-[var(--os-hover)]")}>
        <MoreHorizontal className="w-4 h-4" />
      </button>
    );
  }

  /** Every other action, unchanged. In the table they open in a full-width row below, so no column moves. */
  function renderMenuItems(p: Prospect, where: "card" | "row") {
    const digits = p.phone?.replace(/\D/g, "") || "";
    const item = "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors";
    return (
      <div id={`actions-${where}-${p.id}`} data-testid={`${where}-actions`} className="flex flex-wrap justify-end gap-1">
        {digits && <button onClick={() => handleSendWA(p)} className={cn(item, "bg-emerald-50 os-dark:bg-emerald-500/10 text-emerald-600 os-dark:text-emerald-400 hover:bg-emerald-100 os-dark:hover:bg-emerald-500/15")}><FaWhatsapp className="w-3.5 h-3.5" /> WhatsApp</button>}
        {p.instagram && <button onClick={() => handleSendIG(p)} className={cn(item, "bg-purple-50 os-dark:bg-purple-500/10 text-purple-600 os-dark:text-purple-400 hover:bg-purple-100 os-dark:hover:bg-purple-500/15")}><FaInstagram className="w-3.5 h-3.5" /> {copied === p.id ? "Copied!" : "Instagram"}</button>}
        {digits && <a href={`tel:${p.phone}`} className={cn(item, "bg-amber-50 os-dark:bg-amber-500/10 text-amber-600 os-dark:text-amber-400 hover:bg-amber-100 os-dark:hover:bg-amber-500/15")} title={`Call ${p.phone}`}><Phone className="w-3.5 h-3.5" /> Call</a>}
        {!digits && !p.instagram && <span className="text-[11px] text-red-500 px-2" title="No contact data — audit at /admin/data-audit">no contact</span>}
        {canFollowUp(p) && <button onClick={() => handleFollowUp(p)} className={cn(item, "bg-amber-50 os-dark:bg-amber-500/10 text-amber-600 os-dark:text-amber-400 hover:bg-amber-100 os-dark:hover:bg-amber-500/15")}><Send className="w-3 h-3" /> Follow up</button>}
        {p.status !== "REPONDU" && p.status !== "CONVERTI" && <button onClick={() => handleMarkReplied(p)} className={cn(item, "text-emerald-600 os-dark:text-emerald-400 hover:bg-emerald-50 os-dark:hover:bg-emerald-500/10")}><CheckCircle className="w-3.5 h-3.5" /> Mark replied</button>}
        {p.status !== "PAS_DE_WHATSAPP" && <button onClick={() => handleMarkNoWhatsApp(p)} className={cn(item, "text-red-500 hover:bg-red-50 os-dark:hover:bg-red-500/10")}><PhoneOff className="w-3.5 h-3.5" /> No WhatsApp</button>}
        <Link href={`/admin/prospecting/${p.id}`} className={cn(item, "text-[var(--os-text-muted)] hover:bg-gray-100 os-dark:hover:bg-[var(--os-hover)]")}><ExternalLink className="w-3.5 h-3.5" /> Open</Link>
        <Link href={`/admin/prospecting/${p.id}/edit`} className={cn(item, "text-[var(--os-text-muted)] hover:bg-gray-100 os-dark:hover:bg-[var(--os-hover)]")}><Pencil className="w-3.5 h-3.5" /> Edit</Link>
        <button onClick={() => handleDelete(p.id, p.name)} className={cn(item, "text-[var(--os-text-soft)] hover:text-red-600 os-dark:hover:text-red-400 hover:bg-red-50 os-dark:hover:bg-red-500/10")}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
      </div>
    );
  }

  function renderName(p: Prospect) {
    return (
      <div className="min-w-0">
        <button onClick={() => setDrawerProspectId(p.id)} className="text-[14px] font-semibold text-[var(--os-text)] hover:text-[var(--os-brand)] transition-colors text-left">{p.name}</button>
        {p.instagram && <span className="ml-1.5 text-[11px] text-[var(--os-text-soft)]">@{p.instagram.replace(/^@/, "")}</span>}
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--os-text-soft)]">
          <span>{[p.sector, p.neighborhood].filter(Boolean).join(" · ")}</span>
          {p.score != null && !!p.scoreLabel && <ScoreBadge prospect={p} factors={scoreFactors[p.id]} />}
        </div>
      </div>
    );
  }

  function renderCard(p: Prospect) {
    return (
      <>
        <div className="flex items-start justify-between gap-2 mb-2">
          {renderName(p)}
          <StageBadge prospect={p} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-3"><Chips prospect={p} /></div>
        <div className="flex items-start justify-between gap-2 pt-2.5 border-t border-[var(--os-border)]">
          <div className="pt-0.5">{renderNextAction(p)}</div>
          {renderMenuButton(p, "card")}
        </div>
        {openMenuId === p.id && <div className="mt-2">{renderMenuItems(p, "card")}</div>}
      </>
    );
  }

  const pagination = pages > 1 && (
    <div className="flex justify-center gap-1.5 mt-6">
      {Array.from({ length: pages }, (_, i) => i + 1).map((pg) => (
        <button key={pg} onClick={() => navigate(statusFilter, sectorFilter, pg)} className={cn("w-8 h-8 rounded-lg text-xs font-medium transition-colors", pg === pageParam ? "bg-purple-500 text-white" : "text-[var(--os-text-muted)] hover:bg-gray-100 os-dark:hover:bg-[var(--os-hover)]")}>{pg}</button>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Prospects"
        count={total}
        subtitle="One list. Each prospect shows its next step."
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="flex items-center bg-[var(--os-surface)] border border-[var(--os-border)] rounded-lg p-0.5">
              <button onClick={() => setView("list")} title="List" className={cn("p-1.5 rounded-md transition-colors", view === "list" ? "bg-gradient-to-r from-[#8B00FF]/10 to-[#C026D3]/10 text-[var(--os-brand)]" : "text-[var(--os-text-muted)] hover:text-[var(--os-text)]")}>
                <List className="w-4 h-4" />
              </button>
              <button onClick={() => setView("grid")} title="Cards" className={cn("p-1.5 rounded-md transition-colors", view === "grid" ? "bg-gradient-to-r from-[#8B00FF]/10 to-[#C026D3]/10 text-[var(--os-brand)]" : "text-[var(--os-text-muted)] hover:text-[var(--os-text)]")}>
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
            <Link href="/admin/prospecting/new" className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#8B00FF] to-[#C026D3] hover:opacity-90 text-white rounded-lg text-xs sm:text-sm font-medium transition-all shadow-md shadow-purple-500/20">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> New
            </Link>
          </div>
        }
      />

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--os-text-faint)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name, Instagram, phone, location..."
          className="w-full pl-9 pr-9 py-2.5 bg-[var(--os-surface)] border border-[var(--os-border)] rounded-xl text-[13px] text-[var(--os-text)] placeholder:text-[var(--os-text-faint)] focus:outline-none focus:ring-2 focus:ring-[#8B00FF]/20 focus:border-[#8B00FF]/40 transition-all"
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(""); setDebouncedSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--os-text-faint)] hover:text-[var(--os-text-muted)]">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Four groups (display only: stored statuses are unchanged). Counts follow every filter except a detailed status. */}
      {/* Phones: a 2x2 grid, so all four tabs are visible without scrolling. Wider screens: one row. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-1" data-testid="group-tabs">
        <FilterTabs
          items={VISIBLE_GROUPS.map((g) => ({ value: g.key, label: g.label, count: groupCounts?.[g.key] }))}
          active={groupFilter ?? ""}
          onChange={(v) => showGroup(v as DisplayGroupKey)}
          size="md"
          className="grid grid-cols-2 overflow-visible pb-0 sm:flex sm:overflow-x-auto min-w-0 [&>button]:justify-center sm:[&>button]:justify-start"
        />
        <button
          type="button"
          onClick={() => showGroup("ARCHIVED")}
          title="Unreachable, closed, or an unknown status"
          className={cn("self-end sm:ml-auto shrink-0 inline-flex items-center gap-1 text-[11.5px] hover:underline", groupFilter === "ARCHIVED" ? "text-[var(--os-purple)] font-semibold" : "text-[var(--os-text-faint)]")}
        >
          <Archive className="w-3.5 h-3.5" /> Archived{groupCounts ? ` (${groupCounts.ARCHIVED})` : ""}
        </button>
      </div>
      <p className="text-[11.5px] text-[var(--os-text-faint)] mb-3 min-h-[1em]">{activeGroup?.hint ?? ""}</p>

      {/* An old status= or due= link: shown as a removable filter, with its old meaning. */}
      {(legacyStatusLabel || legacyEvidence || dueFilter === "today" || dueFilter === "overdue") && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          {legacyEvidence && (
            <button type="button" onClick={() => navigate(statusFilter, sectorFilter, 1, ownerFilter, qualityFilter, segmentFilter, dueFilter, channelFilter, "ALL")}
              title="An older outreach-record filter, across all prospects"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12.5px] font-medium border shadow-sm bg-[#0F172A] text-white border-[#0F172A]">
              Outreach: {LEGACY_EVIDENCE_LABELS[evidenceFilter]} <X className="w-3.5 h-3.5 opacity-70" />
            </button>
          )}
          {legacyStatusLabel && (
            <button type="button" onClick={() => navigate("ALL", sectorFilter, 1, ownerFilter, qualityFilter, segmentFilter, dueFilter, channelFilter, evidenceFilter, null)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12.5px] font-medium border shadow-sm bg-[#0F172A] text-white border-[#0F172A]">
              Status: {legacyStatusLabel} <X className="w-3.5 h-3.5 opacity-70" />
            </button>
          )}
          {(dueFilter === "today" || dueFilter === "overdue") && (
            <button type="button" onClick={() => navigate(statusFilter, sectorFilter, 1, ownerFilter, qualityFilter, segmentFilter, "ALL")}
              className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12.5px] font-medium border shadow-sm",
                dueFilter === "overdue" ? "bg-amber-600 text-white border-amber-600" : "bg-[#0F172A] text-white border-[#0F172A]")}>
              {dueFilter === "overdue" ? "Overdue follow-up dates" : "Follow-up dates today"} <X className="w-3.5 h-3.5 opacity-70" />
            </button>
          )}
        </div>
      )}

      {/* More filters — every other filter, number and tool, unchanged, folded away. Opens when one is in use. */}
      <details className="mb-5 rounded-xl border border-[var(--os-border)] bg-[var(--os-surface)]/40" open={advancedCount > 0 || undefined}>
        <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-medium text-[var(--os-text-muted)] hover:text-[var(--os-text)] flex items-center gap-2">
          More filters
          {advancedCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 os-dark:bg-purple-500/15 text-[#7C3AED] os-dark:text-[var(--os-purple)]">{advancedCount} active</span>
          )}
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-2">
          {/* Numbers — the follow-up tiles still open their due views. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {[
              { label: "Warm Contacts", value: kpis?.warmRelationships ?? 0, tone: "emerald" },
              { label: "Legacy Cold", value: kpis?.legacyCold ?? 0, tone: "slate" },
              { label: "Open Proposals", value: kpis ? `${(kpis.proposalValue / 1000).toFixed(0)}k` : "0", suffix: kpis?.currency ?? "MAD", tone: "slate" },
              { label: "Pipeline", value: kpis ? `${(kpis.pipelineValue / 1000).toFixed(0)}k` : "0", suffix: kpis?.currency ?? "MAD", tone: "slate" },
              { label: "Meetings", value: kpis?.meetingsScheduled ?? 0, tone: "slate" },
              { label: "Clients", value: kpis?.clientsWon ?? 0, tone: "emerald" },
              { label: "Follow-up dates", value: kpis?.upcomingFollowups ?? 0, tone: "slate", due: "today" as const, title: "Follow-up dates set in the next 14 days. A date is not evidence that a first message was sent." },
              { label: "Overdue dates", value: kpis?.overdueFollowups ?? 0, tone: "amber", due: "overdue" as const, title: "Follow-up dates in the past, including historical records from before the July 2026 cleanup. Today shows which are backed by a recorded send." },
            ].map((k) => {
              const content = (
                <>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--os-text-faint)] font-medium">{k.label}</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className={cn("text-[16px] font-semibold tabular-nums", k.tone === "emerald" && "text-emerald-700 os-dark:text-emerald-300", k.tone === "slate" && "text-[var(--os-text)]", k.tone === "amber" && "text-amber-700 os-dark:text-amber-300")}>{k.value}</span>
                    {k.suffix && <span className="text-[10px] text-[var(--os-text-faint)] font-medium">{k.suffix}</span>}
                  </div>
                </>
              );
              if ("due" in k && k.due) {
                return (
                  <button key={k.label} type="button" title={k.title} onClick={() => navigate(statusFilter, sectorFilter, 1, ownerFilter, qualityFilter, segmentFilter, k.due)}
                    className={cn("text-left rounded-xl border px-3 py-2 transition-all", dueFilter === k.due ? "bg-[#0F172A]/[0.04] border-[#0F172A]/20 ring-1 ring-[#0F172A]/10" : "bg-[var(--os-surface)]/60 border-[var(--os-border)] hover:border-[#CBD5E1] os-dark:hover:border-[var(--os-border)] hover:bg-[var(--os-surface)]")}>
                    {content}
                  </button>
                );
              }
              return <div key={k.label} className="rounded-xl border border-[var(--os-border)] bg-[var(--os-surface)]/60 px-3 py-2">{content}</div>;
            })}
          </div>

          {/* Contact readiness — a WhatsApp or Instagram confirmed by hand. Not evidence of a send. */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className={rowLabel}>Channel</span>
            {[{ id: "ALL", label: "All" }, { id: "verified", label: "Channel verified" }, { id: "unverified", label: "Channel unverified" }].map((item) => (
              <button key={item.id} onClick={() => navigate(statusFilter, sectorFilter, 1, ownerFilter, qualityFilter, segmentFilter, dueFilter, item.id)}
                className={cn(pill, channelFilter === item.id ? pillOn : pillOff)}>{item.label}</button>
            ))}
          </div>

          {/* Send evidence — stricter rule: a confirmed message since 20 Aug 2026. Older evidence= links still work. */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className={rowLabel}>Message</span>
            {[{ id: "ALL", label: "All" }, { id: "confirmed", label: "Message sent" }, { id: "unconfirmed", label: "Send not confirmed" }].map((item) => (
              <button key={item.id} onClick={() => navigate(statusFilter, sectorFilter, 1, ownerFilter, qualityFilter, segmentFilter, dueFilter, channelFilter, item.id)}
                className={cn(pill, evidenceFilter === item.id ? pillOn : pillOff)}>{item.label}</button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className={rowLabel}>Detailed status</span>
            <FilterTabs
              items={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] || s }))}
              active={statusFilter}
              onChange={(v) => navigate(v, sectorFilter, 1, ownerFilter)}
              className="min-w-0"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={rowLabel}>Segment</span>
            {[
              { value: "ALL" as const, label: "All", dot: "bg-slate-300" },
              ...PROSPECT_SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABELS[s], dot: SEGMENT_TOKENS[s].dot })),
            ].map((seg) => {
              const active = segmentFilter === seg.value;
              return (
                <button key={seg.value} onClick={() => navigate(statusFilter, sectorFilter, 1, ownerFilter, qualityFilter, seg.value)}
                  className={cn("inline-flex items-center gap-2", pill, active ? "bg-[#0F172A] text-white shadow-sm" : pillOff)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-[var(--os-surface)]/70" : seg.dot)} />
                  {seg.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <span className={rowLabel}>Sector</span>
            <FilterTabs
              items={SECTORS.map((s) => ({ value: s, label: s === "ALL" ? "All sectors" : s }))}
              active={sectorFilter}
              onChange={(v) => navigate(statusFilter, v, 1, ownerFilter)}
              className="min-w-0"
              scrollable
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className={rowLabel}>Quality</span>
            {[{ id: "ALL", label: "All" }, { id: "HOT", label: "🔥 HOT only" }, { id: "WARM", label: "WARM" }, { id: "COLD", label: "COLD" }].map((item) => (
              <button key={item.id} onClick={() => navigate(statusFilter, sectorFilter, 1, ownerFilter, item.id)}
                className={cn(pill, qualityFilter === item.id ? pillOn : pillOff)}>{item.label}</button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className={rowLabel}>Owner</span>
            {[
              { id: "ALL", label: "All", count: 0 },
              { id: "UNASSIGNED", label: "Unassigned", count: 0 },
              ...ownerStats.map((o) => ({ id: o.id, label: o.avatarInitials, count: o.count })),
            ].map((item) => (
              <button key={item.id} onClick={() => navigate(statusFilter, sectorFilter, 1, item.id)}
                className={cn("flex items-center gap-1.5 shrink-0", pill, ownerFilter === item.id ? pillOn : pillOff)}>
                {item.label}
                {item.count > 0 && <span className={cn("text-[10px] font-bold px-1 rounded-full", ownerFilter === item.id ? "bg-[var(--os-surface)]/25" : "bg-[var(--os-hover)]")}>{item.count}</span>}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={rowLabel}>Tools</span>
            <button onClick={() => setSortByScore(!sortByScore)} title="Sort this page by score (highest first)"
              className={cn("inline-flex items-center gap-1.5", pill, sortByScore ? pillOn : pillOff)}>
              <ArrowUpDown className="w-3.5 h-3.5" /> Sort by score
            </button>
            <button onClick={handleScoreAll} disabled={scoring} title="Score all prospects" className={cn("inline-flex items-center gap-1.5 disabled:opacity-50", pill, pillOff)}>
              <Zap className={cn("w-3.5 h-3.5", scoring && "animate-pulse text-amber-500")} /> {scoring ? "Scoring..." : "Score all"}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={importing} className={cn("inline-flex items-center gap-1.5 disabled:opacity-50", pill, pillOff)}>
              <Upload className="w-3.5 h-3.5" /> {importing ? "Importing..." : "Import CSV"}
            </button>
          </div>

          {advancedCount > 0 && (
            <button type="button" onClick={() => navigate("ALL", "ALL", 1, "ALL", "ALL", "ALL", dueFilter, "ALL", "ALL", groupFilter)} className="text-[11.5px] text-[#7C3AED] os-dark:text-[var(--os-purple)] hover:underline">
              Clear filters
            </button>
          )}
        </div>
      </details>

      {loading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="os-skeleton h-14 rounded-lg" />)}</div>
      ) : prospects.length === 0 ? (
        <EmptyState icon={<Target className="w-6 h-6" />} title="No prospects here" description="Try another group, change the filters, or add a prospect." />
      ) : view === "list" ? (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {displayedProspects.map((p) => (
              <div key={p.id} className="rounded-xl border border-[var(--os-border)] bg-[var(--os-surface)]/80 p-3.5">{renderCard(p)}</div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block border border-[var(--os-border)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--os-border)] bg-gray-50 os-dark:bg-[var(--os-surface-2)]">
                  <th className="text-left px-4 py-2.5 text-[var(--os-text-muted)] font-medium text-[11px] uppercase tracking-wider">Prospect</th>
                  <th className="text-left px-4 py-2.5 text-[var(--os-text-muted)] font-medium text-[11px] uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2.5 text-[var(--os-text-muted)] font-medium text-[11px] uppercase tracking-wider">Next step</th>
                  <th className="px-4 py-2.5"><span className="sr-only">More</span></th>
                </tr>
              </thead>
              <tbody>
                {displayedProspects.map((p) => (
                  <Fragment key={p.id}>
                    <tr className={cn("hover:bg-gray-50 os-dark:hover:bg-[var(--os-surface-2)] transition-colors align-top", openMenuId !== p.id && "border-b border-[var(--os-border)]")}>
                      <td className="px-4 py-3">{renderName(p)}</td>
                      <td className="px-4 py-3"><div className="flex flex-col items-start gap-1"><StageBadge prospect={p} /><div className="flex flex-wrap gap-1"><Chips prospect={p} /></div></div></td>
                      <td className="px-4 py-3">{renderNextAction(p)}</td>
                      <td className="px-4 py-3 text-right w-12">{renderMenuButton(p, "row")}</td>
                    </tr>
                    {openMenuId === p.id && (
                      <tr className="border-b border-[var(--os-border)] bg-gray-50/60 os-dark:bg-[var(--os-surface-2)]">
                        <td colSpan={4} className="px-4 pb-3 pt-0">{renderMenuItems(p, "row")}</td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          {pagination}
        </>
      ) : (
        /* Card view */
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {displayedProspects.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.02 }}
                className="rounded-xl border border-[var(--os-border)] bg-[var(--os-surface)]/80 p-4 hover:border-[var(--os-border-hover)] transition-all">
                {renderCard(p)}
              </motion.div>
            ))}
          </div>
          {pagination}
        </>
      )}
      {pendingSend && (
        <div className="fixed z-50 left-4 right-4 bottom-20 lg:bottom-6 lg:left-auto lg:w-[420px] shadow-2xl rounded-xl bg-[var(--os-surface)]">
          <SendConfirm
            key={`${pendingSend.prospect.id}:${pendingSend.channel}:${pendingSend.kind}`}
            channel={pendingSend.channel}
            name={pendingSend.prospect.name}
            askNext={pendingSend.kind === "follow_up"}
            error={sendError}
            onConfirm={confirmPendingSend}
            onCancel={() => { setPendingSend(null); setSendError(null); }}
          />
        </div>
      )}
      <ProspectDrawer
        prospectId={drawerProspectId}
        onClose={() => setDrawerProspectId(null)}
        onUpdate={(updated: Record<string, unknown>) => {
          setProspects((prev) => prev.map((pr) => pr.id === updated.id ? { ...pr, ...updated } as Prospect : pr));
        }}
      />
    </div>
  );
}
