"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { HiOutlinePlus, HiOutlineArrowUpTray, HiOutlinePaperAirplane, HiOutlinePencilSquare, HiOutlineTrash } from "react-icons/hi2";
import { FaWhatsapp, FaInstagram } from "react-icons/fa";

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
  "Avocat": [
    (ig, f) => `Bonjour Maître, je suis Ayoub d'Ibda3 Digital, agence web à Marrakech. Beaucoup de justiciables cherchent un avocat sur Google mais tombent sur des annuaires génériques. Un site personnel avec vos domaines de compétence et formulaire de contact vous positionnerait directement. Voici notre travail : https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour Maître, Ayoub d'Ibda3 Digital ici. Je travaille avec des professionnels à Marrakech pour améliorer leur visibilité en ligne. Un site web professionnel avec votre parcours, honoraires et prise de RDV pourrait vous démarquer. Un échange rapide ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour Maître, je me permets de vous contacter car je remarque que beaucoup de cabinets d'avocats à Marrakech n'ont pas encore de site web. Pourtant c'est souvent le premier réflexe des gens qui cherchent un avocat. On peut créer quelque chose de sobre et efficace. Voici un aperçu : https://ibda3-digital.vercel.app`,
  ],
  "Architecte/Décorateur": [
    (ig, f) => `Bonjour ! Ayoub d'Ibda3 Digital ici.${ig ? ` Vos projets sur @${ig}${f} sont vraiment inspirants.` : ""} Pour un architecte, un portfolio en ligne bien designé c'est comme une carte de visite premium — ça attire les bons clients. On est spécialisés là-dedans : https://ibda3-digital.vercel.app`,
    (ig, f) => `Salam !${ig ? ` J'ai découvert vos réalisations via @${ig}${f}, chapeau !` : ""} Je suis développeur web à Marrakech et on crée des sites portfolio sur mesure pour les architectes et designers. Un site à la hauteur de votre travail, ça vous tente ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour,${ig ? ` je suis tombé sur @${ig}${f} et vos projets sont magnifiques.` : ""} Je suis Ayoub d'Ibda3 Digital. Les clients premium qui cherchent un architecte à Marrakech passent par Google — un site soigné avec vos réalisations ferait la différence. Voici le nôtre : https://ibda3-digital.vercel.app`,
  ],
  "Immobilier": [
    (ig, f) => `Bonjour ! Ayoub d'Ibda3 Digital ici.${ig ? ` J'ai vu votre activité sur @${ig}${f}.` : ""} Un site immobilier avec recherche par quartier, fiches bien détaillées et contact WhatsApp intégré peut vraiment booster vos ventes. Intéressé ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Salam !${ig ? ` J'ai découvert votre agence via @${ig}${f}.` : ""} Je suis développeur web à Marrakech. La plupart des acheteurs commencent leur recherche en ligne — un site pro avec vos annonces vous donnerait un avantage sur la concurrence. Voici ce qu'on fait : https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour,${ig ? ` je suis passé sur @${ig}${f}, belles annonces !` : ""} Je suis Ayoub d'Ibda3 Digital. On crée des sites immobiliers modernes — catalogue de biens, filtres, localisation, tout intégré. Un échange rapide ? https://ibda3-digital.vercel.app`,
  ],
  "Restaurant/Café": [
    (ig, f) => `Salam ! Ayoub d'Ibda3 Digital ici.${ig ? ` J'ai vu @${ig}${f}, ça donne faim !` : ""} Un site avec votre carte, photos et réservation en ligne ça attire les touristes et locaux qui cherchent sur Google "où manger à Marrakech". Voici notre travail : https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour ! Je suis développeur web à Marrakech.${ig ? ` Votre resto sur @${ig}${f} a l'air incroyable.` : ""} Aujourd'hui, les gens Google avant de sortir manger. Un site avec menu, ambiance et réservation, c'est ce qui fait la différence. On en parle ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Hello !${ig ? ` J'ai découvert @${ig}${f}, super concept !` : ""} Je suis Ayoub d'Ibda3 Digital. Beaucoup de restaurants perdent des clients parce qu'ils n'apparaissent pas sur Google. Un site optimisé règle ça. Jetez un oeil : https://ibda3-digital.vercel.app`,
  ],
  "Patisserie": [
    (ig, f) => `Bonjour ! Ayoub d'Ibda3 Digital ici.${ig ? ` Vos créations sur @${ig}${f} sont magnifiques !` : ""} Un site avec vos pâtisseries en photo, carte et commande en ligne pourrait vraiment développer votre clientèle. On adore faire ça : https://ibda3-digital.vercel.app`,
    (ig, f) => `Salam !${ig ? ` J'ai craqué en voyant @${ig}${f}, quel talent !` : ""} Je suis développeur web à Marrakech. Un beau site e-commerce pour vos gâteaux et commandes, ça vous tente ? Voici ce qu'on fait : https://ibda3-digital.vercel.app`,
    (ig, f) => `Hello !${ig ? ` @${ig}${f}, wow les pâtisseries !` : ""} Je suis Ayoub d'Ibda3 Digital. Imaginez vos clientes qui commandent en ligne pour les fêtes et mariages, sans appeler. Un site peut faire ça. On en discute ? https://ibda3-digital.vercel.app`,
  ],
  "Boulangerie": [
    (ig, f) => `Bonjour ! Ayoub d'Ibda3 Digital.${ig ? ` J'ai vu votre boulangerie sur @${ig}${f}, ça a l'air super !` : ""} Un site avec vos produits, horaires et commande en ligne pourrait vous ramener de nouveaux clients du quartier et au-delà. Notre portfolio : https://ibda3-digital.vercel.app`,
    (ig, f) => `Salam !${ig ? ` Belle page @${ig}${f} !` : ""} Je suis développeur web à Marrakech. Les gens cherchent de plus en plus "boulangerie près de moi" sur Google — un site simple et beau vous mettrait en avant. Intéressé ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Hello !${ig ? ` J'ai découvert @${ig}${f}, beaux produits !` : ""} Je suis Ayoub d'Ibda3 Digital. Un site vitrine avec vos spécialités, livraison et horaires ça prend 10 jours à créer et ça travaille pour vous 24h/24. On en parle ? https://ibda3-digital.vercel.app`,
  ],
  "Riad/Maison d'hôtes": [
    (ig, f) => `Bonjour ! Ayoub d'Ibda3 Digital ici.${ig ? ` Votre riad sur @${ig}${f} est magnifique !` : ""} Saviez-vous que 78% des voyageurs visitent le site d'un hébergement avant de réserver ? Un site avec galerie, tarifs et réservation directe vous éviterait les commissions Booking. On en discute ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Salam !${ig ? ` J'ai découvert @${ig}${f}, quelle ambiance !` : ""} Je suis développeur web à Marrakech. Chaque réservation via Booking vous coûte 15-20% de commission — un site avec réservation directe vous garde cette marge. Voici ce qu'on sait faire : https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour,${ig ? ` je suis tombé sur @${ig}${f} et votre riad a l'air exceptionnel.` : ""} Je suis Ayoub d'Ibda3 Digital. Un site élégant avec photos, avis et réservation WhatsApp ou en ligne ferait passer votre établissement au niveau supérieur. Un aperçu : https://ibda3-digital.vercel.app`,
  ],
  "Photographe/Vidéaste": [
    (ig, f) => `Salut !${ig ? ` Je viens de voir ton travail sur @${ig}${f} — franchement c'est du lourd !` : ""} Je suis Ayoub d'Ibda3 Digital. Un vrai site portfolio avec tes galeries, tes tarifs et un formulaire de devis c'est ce qui transforme un visiteur Google en client. Ça t'intéresse ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Hey !${ig ? ` Ton feed @${ig}${f} est incroyable,` : " Ton travail est incroyable,"} surtout les shootings mariage. Je suis développeur web à Marrakech. Quand quelqu'un tape "photographe mariage Marrakech" sur Google, il faut que ce soit toi qui apparaisse. Un site portfolio fait exactement ça. On en parle ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Salut !${ig ? ` @${ig}${f}, beau boulot !` : ""} Je suis Ayoub d'Ibda3 Digital. Instagram c'est top pour montrer ton travail, mais un site te donne le contrôle total — SEO, galeries plein écran, page tarifs, avis clients. Le combo parfait. Voici le nôtre : https://ibda3-digital.vercel.app`,
  ],
  "Traiteur": [
    (ig, f) => `Bonjour ! Ayoub d'Ibda3 Digital ici.${ig ? ` J'ai vu @${ig}${f}, vos réalisations sont superbes !` : ""} Un site avec vos menus, photos d'événements et formulaire de devis en ligne pourrait vous amener des clients pour les mariages et fêtes. On en discute ? https://ibda3-digital.vercel.app`,
    (ig, f) => `Salam !${ig ? ` Belle page @${ig}${f} !` : ""} Je suis développeur web à Marrakech. Les couples qui organisent leur mariage cherchent "traiteur Marrakech" sur Google — un site pro vous positionnerait en premier. Voici notre travail : https://ibda3-digital.vercel.app`,
    (ig, f) => `Bonjour,${ig ? ` j'ai découvert @${ig}${f}, quel savoir-faire !` : ""} Je suis Ayoub d'Ibda3 Digital. Imaginez un site où vos clients parcourent vos formules, voient vos événements passés et demandent un devis en 2 clics. On peut créer ça. Un aperçu : https://ibda3-digital.vercel.app`,
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
const STATUS_LABELS: Record<string, string> = {
  ALL: "Tous",
  A_ENVOYER: "À envoyer",
  ENVOYE: "Envoyé",
  REPONDU: "Répondu",
  PAS_DE_WHATSAPP: "Pas de WhatsApp",
  CONVERTI: "Converti",
};
const STATUS_COLORS: Record<string, string> = {
  A_ENVOYER: "bg-blue-500/20 text-blue-400",
  ENVOYE: "bg-yellow-500/20 text-yellow-400",
  REPONDU: "bg-green-500/20 text-green-400",
  PAS_DE_WHATSAPP: "bg-red-500/20 text-red-400",
  CONVERTI: "bg-violet-500/20 text-violet-400",
};
const PRIORITY_COLORS: Record<number, string> = {
  1: "bg-green-500/20 text-green-400",
  2: "bg-yellow-500/20 text-yellow-400",
  3: "bg-gray-500/20 text-gray-400",
};
const PRIORITY_LABELS: Record<number, string> = {
  1: "IG sans site",
  2: "Sans site",
  3: "A un site",
};
const SECTORS = [
  "ALL", "Dentiste", "Salon Beauté", "Salle de Sport", "Avocat",
  "Architecte/Décorateur", "Immobilier", "Restaurant/Café",
  "Patisserie", "Boulangerie", "Riad/Maison d'hôtes",
  "Photographe/Vidéaste", "Traiteur",
];

type Prospect = {
  id: string;
  name: string;
  phone: string;
  whatsappLink: string;
  sector: string;
  neighborhood: string;
  instagram: string;
  hasWebsite: boolean;
  priority: number;
  status: string;
  sentAt: string | null;
  createdAt: string;
  notes: { id: string; content: string; createdAt: string }[];
};

export default function ProspectingPage() {
  return (
    <Suspense fallback={<div className="text-gray-500 animate-pulse">Loading...</div>}>
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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (statusFilter !== "ALL") qs.set("status", statusFilter);
    if (sectorFilter !== "ALL") qs.set("sector", sectorFilter);
    qs.set("page", String(pageParam));

    fetch(`/api/admin/prospecting?${qs}`)
      .then((r) => {
        if (r.status === 401) { router.push("/admin/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setProspects(data.prospects);
          setTotal(data.total);
          setPages(data.pages);
        }
        setLoading(false);
      });
  }, [statusFilter, sectorFilter, pageParam, router]);

  function navigate(status: string, sector: string, page = 1) {
    const qs = new URLSearchParams();
    if (status !== "ALL") qs.set("status", status);
    if (sector !== "ALL") qs.set("sector", sector);
    if (page > 1) qs.set("page", String(page));
    router.push(`/admin/prospecting${qs.toString() ? `?${qs}` : ""}`);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete prospect "${name}"?`)) return;
    const res = await fetch(`/api/admin/prospecting/${id}`, { method: "DELETE" });
    if (res.ok) setProspects((prev) => prev.filter((p) => p.id !== id));
  }

  const [copied, setCopied] = useState<string | null>(null);

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
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    } else if (p.instagram) {
      try { await navigator.clipboard.writeText(msg); } catch { /* clipboard blocked */ }
      setCopied(p.id);
      setTimeout(() => setCopied(null), 3000);
      const handle = p.instagram.replace(/^@/, "");
      window.open(`https://ig.me/m/${handle}`, "_blank");
    } else {
      alert("No phone or Instagram for this prospect.");
      return;
    }

    if (p.status === "A_ENVOYER" || p.status === "PAS_DE_WHATSAPP") {
      const res = await fetch(`/api/admin/prospecting/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ENVOYE" }),
      });
      if (res.ok) {
        setProspects((prev) =>
          prev.map((pr) => pr.id === p.id ? { ...pr, status: "ENVOYE", sentAt: new Date().toISOString() } : pr)
        );
      }
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
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    } else if (p.instagram) {
      try { await navigator.clipboard.writeText(msg); } catch {}
      setCopied(p.id);
      setTimeout(() => setCopied(null), 3000);
      const handle = p.instagram.replace(/^@/, "");
      window.open(`https://ig.me/m/${handle}`, "_blank");
    } else {
      return;
    }

    // Re-mark as ENVOYE with fresh sentAt so follow-up button resets
    await fetch(`/api/admin/prospecting/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ENVOYE" }),
    }).catch(() => {});
    setProspects((prev) =>
      prev.map((pr) => pr.id === p.id ? { ...pr, status: "ENVOYE", sentAt: new Date().toISOString() } : pr)
    );
  }

  async function handleMarkNoWhatsApp(p: Prospect) {
    await fetch(`/api/admin/prospecting/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAS_DE_WHATSAPP" }),
    });
    setProspects((prev) =>
      prev.map((pr) => pr.id === p.id ? { ...pr, status: "PAS_DE_WHATSAPP" } : pr)
    );
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/prospecting/import", { method: "POST", body: formData });
    const data = await res.json();
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.ok) {
      alert(`Imported ${data.imported} prospects.${data.errors?.length ? `\n\nErrors:\n${data.errors.join("\n")}` : ""}`);
      navigate(statusFilter, sectorFilter, 1);
    } else {
      alert(`Import failed: ${data.error}`);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-100">
          Prospecting <span className="text-gray-500 text-lg font-normal">({total})</span>
        </h1>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 border border-white/10 hover:border-white/20 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50"
          >
            <HiOutlineArrowUpTray className="w-4 h-4" />
            {importing ? "Importing..." : "Import CSV"}
          </button>
          <Link
            href="/admin/prospecting/new"
            className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <HiOutlinePlus className="w-4 h-4" />
            New Prospect
          </Link>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 mb-3">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => navigate(s, sectorFilter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-violet-500/15 text-violet-400"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            }`}
          >
            {STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      {/* Sector filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SECTORS.map((s) => (
          <button
            key={s}
            onClick={() => navigate(statusFilter, s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sectorFilter === s
                ? "bg-violet-500/15 text-violet-400"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            }`}
          >
            {s === "ALL" ? "Tous secteurs" : s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 animate-pulse">Loading...</div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No prospects found.</div>
      ) : (
        <>
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Sector</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Quartier</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Priority</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Sent</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/prospecting/${p.id}`} className="text-gray-200 font-medium hover:text-violet-400 transition-colors">
                        {p.name}
                      </Link>
                      {p.instagram && (
                        <span className="ml-2 text-xs text-gray-500">@{p.instagram.replace(/^@/, "")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{p.sector}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{p.neighborhood || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${PRIORITY_COLORS[p.priority] ?? PRIORITY_COLORS[2]}`}>
                        {PRIORITY_LABELS[p.priority] ?? `P${p.priority}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[p.status] ?? STATUS_COLORS.A_ENVOYER}`}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {p.sentAt ? new Date(p.sentAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {p.status === "ENVOYE" && p.sentAt && (Date.now() - new Date(p.sentAt).getTime()) > 3 * 86400000 && (
                          <button
                            onClick={() => handleFollowUp(p)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                            title="Send follow-up message"
                          >
                            <HiOutlinePaperAirplane className="w-3.5 h-3.5" />
                            {copied === p.id ? "Copied!" : "Follow up"}
                          </button>
                        )}
                        <button
                          onClick={() => handleSend(p)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            (() => {
                              const d = p.phone?.replace(/\D/g, "") || "";
                              const land = /^0?5\d{8}$/.test(d) || /^2125\d{8}$/.test(d);
                              const hasMobile = p.phone && !land;
                              if (p.status !== "A_ENVOYER") return "bg-white/5 text-gray-500 hover:bg-white/10";
                              if (hasMobile) return "bg-green-500/20 text-green-400 hover:bg-green-500/30";
                              if (p.instagram) return "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30";
                              return "bg-gray-500/20 text-gray-500 cursor-not-allowed";
                            })()
                          }`}
                          title={(() => { const d = p.phone?.replace(/\D/g, "") || ""; const land = /^0?5\d{8}$/.test(d) || /^2125\d{8}$/.test(d); return p.phone && !land ? "Send WhatsApp" : p.instagram ? "Send Instagram DM" : "No contact"; })()}
                        >
                          {(() => { const d = p.phone?.replace(/\D/g, "") || ""; const land = /^0?5\d{8}$/.test(d) || /^2125\d{8}$/.test(d); return p.phone && !land ? <FaWhatsapp className="w-3.5 h-3.5" /> : <FaInstagram className="w-3.5 h-3.5" />; })()}
                          {copied === p.id ? "Copied! Paste in DM" : p.status === "A_ENVOYER" ? "Send" : "Resend"}
                        </button>
                        {p.status !== "PAS_DE_WHATSAPP" && (
                          <button
                            onClick={() => handleMarkNoWhatsApp(p)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-colors"
                            title="Mark as Pas de WhatsApp"
                          >
                            <FaWhatsapp className="w-3 h-3" />
                            <span className="line-through">WA</span>
                          </button>
                        )}
                        <Link
                          href={`/admin/prospecting/${p.id}/edit`}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 transition-colors"
                          title="Edit"
                        >
                          <HiOutlinePencilSquare className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => navigate(statusFilter, sectorFilter, p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    p === pageParam
                      ? "bg-violet-500 text-white"
                      : "text-gray-500 hover:bg-white/10"
                  }`}
                >
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
