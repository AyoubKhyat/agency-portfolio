import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { HiOutlineCheck, HiOutlineChatBubbleLeft } from "react-icons/hi2";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/motion";

type SectorData = {
  slug: string;
  title: string;
  tagline: string;
  intro: string;
  pain: string[];
  features: string[];
  steps: { title: string; desc: string }[];
  faq: { q: string; a: string }[];
  cta: string;
};

const SECTORS: Record<string, SectorData> = {
  dentistes: {
    slug: "dentistes",
    title: "Sites Web pour Dentistes à Marrakech",
    tagline: "Attirez plus de patients avec une présence en ligne professionnelle",
    intro: "Vous êtes dentiste à Marrakech et vos patients vous trouvent uniquement par le bouche-à-oreille ? 73% des patients cherchent un dentiste sur Google avant de prendre rendez-vous. Un site web professionnel avec prise de RDV en ligne vous positionne en tête des résultats.",
    pain: [
      "Vos patients potentiels cherchent \"dentiste Marrakech\" sur Google et trouvent vos concurrents",
      "Vous perdez du temps à gérer les appels pour des prises de rendez-vous",
      "Vous n'avez aucune vitrine en ligne pour montrer votre cabinet et vos spécialités",
    ],
    features: [
      "Prise de rendez-vous en ligne 24h/24",
      "Présentation de vos spécialités et soins",
      "Galerie photos du cabinet",
      "Avis et témoignages patients",
      "Fiche Google My Business optimisée",
      "Formulaire de contact WhatsApp intégré",
      "Design responsive (mobile + desktop)",
      "Référencement SEO local Marrakech",
    ],
    steps: [
      { title: "Échange & Maquette", desc: "On discute de vos besoins en 30 min. Vous recevez une maquette personnalisée sous 48h." },
      { title: "Développement", desc: "On construit votre site en 7-10 jours. Vous validez chaque étape." },
      { title: "Mise en ligne & SEO", desc: "Votre site est live, optimisé pour Google, et vous commencez à recevoir des patients." },
    ],
    faq: [
      { q: "Combien coûte un site web pour un cabinet dentaire ?", a: "Nos sites commencent à partir de 5 000 MAD. Le prix dépend des fonctionnalités (réservation en ligne, multilingue, etc.). Contactez-nous pour un devis gratuit." },
      { q: "Combien de temps pour créer mon site ?", a: "Votre site est prêt en 7 à 10 jours ouvrables après validation de la maquette." },
      { q: "Mon site sera-t-il visible sur Google ?", a: "Oui. On optimise chaque site pour le référencement local — votre cabinet apparaîtra quand quelqu'un cherche \"dentiste Marrakech\" ou \"dentiste [votre quartier]\"." },
      { q: "Puis-je modifier le contenu moi-même ?", a: "Oui, on vous donne accès à un panneau d'administration simple pour modifier textes, photos et horaires." },
    ],
    cta: "Recevez plus de patients dès ce mois-ci",
  },
  salons: {
    slug: "salons",
    title: "Sites Web pour Salons de Beauté à Marrakech",
    tagline: "Transformez vos abonnées Instagram en clientes fidèles",
    intro: "Votre salon a un beau feed Instagram, mais vos clientes ne peuvent pas réserver en dehors des heures d'ouverture. Un site web avec galerie avant/après, tarifs et réservation en ligne travaille pour vous 24h/24 — même quand vous êtes occupée.",
    pain: [
      "Vos clientes vous appellent ou DM pour connaître les prix — vous perdez du temps à répondre",
      "Vous dépendez uniquement d'Instagram, qui peut changer son algorithme à tout moment",
      "Les nouvelles clientes ne vous trouvent pas sur Google — elles vont chez la concurrence",
    ],
    features: [
      "Réservation en ligne avec choix de prestation",
      "Galerie avant/après de vos réalisations",
      "Tarifs et menu des soins",
      "Intégration WhatsApp pour contact direct",
      "Avis et témoignages clientes",
      "Lien Instagram intégré",
      "Design élégant adapté à votre image",
      "SEO local : \"salon beauté Marrakech\"",
    ],
    steps: [
      { title: "Photos & Identité", desc: "On récupère vos meilleures photos et on définit le style visuel de votre site." },
      { title: "Création du site", desc: "En 7 jours, votre site est prêt avec toutes vos prestations, tarifs et réservation." },
      { title: "Lancement & Visibilité", desc: "Votre site est en ligne, lié à votre Instagram, et référencé sur Google." },
    ],
    faq: [
      { q: "Est-ce que mes clientes pourront réserver en ligne ?", a: "Oui ! Elles choisissent la prestation, la date et l'heure. Vous recevez une notification WhatsApp." },
      { q: "J'ai déjà Instagram, pourquoi un site web ?", a: "Instagram est limité : pas de réservation, pas de tarifs clairs, pas de référencement Google. Un site web complète votre Instagram et attire les clientes qui cherchent sur Google." },
      { q: "Combien ça coûte ?", a: "À partir de 4 000 MAD. Contactez-nous pour un devis adapté à vos besoins." },
    ],
    cta: "Remplissez votre agenda en ligne",
  },
  immobilier: {
    slug: "immobilier",
    title: "Sites Web pour Agences Immobilières à Marrakech",
    tagline: "Présentez vos biens et attirez des acheteurs qualifiés en ligne",
    intro: "Les acheteurs commencent leur recherche immobilière sur Google, pas dans la rue. Un site professionnel avec catalogue de biens, recherche par quartier et contact direct vous positionne devant les portails généralistes et vous apporte des leads qualifiés.",
    pain: [
      "Vos annonces sont noyées sur Avito et les portails généralistes",
      "Les acheteurs sérieux vous trouvent difficilement sans site dédié",
      "Vous n'avez pas de vitrine professionnelle pour les biens premium",
    ],
    features: [
      "Catalogue de biens avec photos et détails",
      "Recherche par quartier, prix et type de bien",
      "Fiches détaillées avec galerie et plan",
      "Formulaire de contact par bien",
      "WhatsApp intégré pour contact instantané",
      "Google Maps pour la localisation",
      "Design premium pour les biens haut de gamme",
      "SEO : \"immobilier Marrakech\", \"appartement Gueliz\"",
    ],
    steps: [
      { title: "Analyse & Structure", desc: "On définit ensemble les catégories de biens, les filtres et le design de votre site." },
      { title: "Développement", desc: "En 10-14 jours, votre site est prêt avec un back-office pour ajouter/modifier vos biens." },
      { title: "Go Live & SEO", desc: "Votre site est en ligne, optimisé pour Google, et vous commencez à recevoir des demandes." },
    ],
    faq: [
      { q: "Puis-je ajouter des biens moi-même ?", a: "Oui, vous aurez un panneau d'administration simple pour ajouter, modifier et supprimer vos annonces avec photos." },
      { q: "Mon site sera-t-il mieux référencé qu'Avito ?", a: "Pour les recherches locales comme \"appartement Gueliz Marrakech\", oui. Un site dédié à votre agence sera mieux positionné qu'une annonce perdue sur un portail." },
      { q: "Quel est le prix ?", a: "À partir de 7 000 MAD selon les fonctionnalités. Devis gratuit sur demande." },
    ],
    cta: "Vendez plus de biens grâce à votre site",
  },
  riads: {
    slug: "riads",
    title: "Sites Web pour Riads & Maisons d'Hôtes à Marrakech",
    tagline: "Doublez vos réservations directes, zéro commission",
    intro: "Chaque réservation via Booking vous coûte 15-20% de commission. 78% des voyageurs visitent le site web d'un hébergement avant de réserver. Un site élégant avec réservation directe vous garde cette marge — et vous donne le contrôle sur votre image.",
    pain: [
      "Booking et Airbnb prennent 15-20% de commission sur chaque réservation",
      "Vous n'avez pas de contrôle sur votre image de marque sur les plateformes",
      "Les voyageurs ne peuvent pas réserver directement sans passer par un intermédiaire",
    ],
    features: [
      "Galerie photos immersive de vos chambres",
      "Réservation directe en ligne (sans commission)",
      "Tarifs par saison et type de chambre",
      "Intégration WhatsApp pour contact voyageurs",
      "Avis et témoignages clients",
      "Multilingue : français, anglais, arabe",
      "Google Maps et informations pratiques",
      "SEO : \"riad Marrakech\", \"maison d'hôtes Medina\"",
    ],
    steps: [
      { title: "Shooting & Contenu", desc: "On met en valeur vos plus belles photos. Si besoin, on vous recommande un photographe." },
      { title: "Site & Réservation", desc: "En 10 jours, votre site est prêt avec réservation en ligne et tarifs par saison." },
      { title: "Visibilité & Avis", desc: "Votre site est référencé sur Google et lié à votre fiche Google My Business." },
    ],
    faq: [
      { q: "Comment fonctionne la réservation directe ?", a: "Les voyageurs choisissent leur chambre et leurs dates, puis vous recevez la demande par email et WhatsApp. Vous confirmez manuellement — pas de paiement en ligne obligatoire." },
      { q: "Est-ce que ça remplace Booking ?", a: "Non, ça le complète. Vous gardez Booking pour la visibilité mais vous redirigez les voyageurs vers votre site pour les réservations directes (0% commission)." },
      { q: "Combien ça coûte ?", a: "À partir de 6 000 MAD. Le site se rembourse en quelques réservations directes." },
    ],
    cta: "Arrêtez de payer des commissions",
  },
  restaurants: {
    slug: "restaurants",
    title: "Sites Web pour Restaurants & Cafés à Marrakech",
    tagline: "Remplissez vos tables grâce à Google",
    intro: "Quand un touriste ou un Marrakchi cherche \"où manger à Marrakech\" sur Google, est-ce que votre restaurant apparaît ? Un site web avec votre menu, vos photos et la réservation en ligne vous rend visible et accessible 24h/24.",
    pain: [
      "Les touristes cherchent sur Google et TripAdvisor — sans site, vous êtes invisible",
      "Votre menu n'est disponible nulle part en ligne — les clients ne savent pas ce que vous proposez",
      "Vous perdez des réservations le soir et le weekend quand personne ne décroche le téléphone",
    ],
    features: [
      "Menu digital avec photos des plats",
      "Réservation de table en ligne",
      "Localisation Google Maps intégrée",
      "Galerie photos de l'ambiance et des plats",
      "Horaires d'ouverture toujours à jour",
      "Lien WhatsApp pour commandes et réservations",
      "Design qui reflète l'identité de votre restaurant",
      "SEO : \"restaurant Marrakech\", \"café Gueliz\"",
    ],
    steps: [
      { title: "Menu & Photos", desc: "On récupère votre carte et vos meilleures photos. On peut aussi photographier vos plats." },
      { title: "Création du site", desc: "En 5-7 jours, votre site est prêt avec menu, galerie et réservation." },
      { title: "Google & Visibilité", desc: "Votre site est optimisé pour Google Maps et les recherches locales." },
    ],
    faq: [
      { q: "Est-ce que les clients pourront commander en ligne ?", a: "Oui, on peut intégrer un bouton WhatsApp pour les commandes ou un formulaire de réservation." },
      { q: "J'ai déjà une page Instagram, c'est suffisant ?", a: "Instagram ne remplace pas un site web. Un site vous donne un menu permanent, une localisation claire et un meilleur référencement Google." },
      { q: "Combien ça coûte ?", a: "À partir de 4 000 MAD pour un site vitrine avec menu et réservation." },
    ],
    cta: "Remplissez vos tables ce soir",
  },
};

const SLUGS = Object.keys(SECTORS);
const BASE_URL = "https://ibda3-digital.vercel.app";

function SectorJsonLd({ slug, sector }: { slug: string; sector: SectorData }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: sector.title,
    description: sector.intro,
    url: `${BASE_URL}/fr/sectors/${slug}`,
    provider: {
      "@type": "ProfessionalService",
      name: "Ibda3 Digital",
      url: BASE_URL,
      telephone: "+212625461645",
      address: { "@type": "PostalAddress", addressLocality: "Marrakech", addressCountry: "MA" },
    },
    areaServed: { "@type": "City", name: "Marrakech" },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
}

function FaqJsonLd({ faq }: { faq: { q: string; a: string }[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />;
}

export async function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const sector = SECTORS[slug];
  if (!sector) return {};
  return {
    title: `${sector.title} — Ibda3 Digital`,
    description: sector.intro,
  };
}

export default async function SectorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sector = SECTORS[slug];
  if (!sector) notFound();

  return (
    <>
      <SectorJsonLd slug={slug} sector={sector} />
      <FaqJsonLd faq={sector.faq} />

      {/* Hero */}
      <section className="relative bg-background py-24 md:py-32 overflow-hidden">
        <div className="grid-bg" />
        <div className="glow w-[800px] h-[800px] bg-primary -top-48 -left-48 opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <span className="pill">Marrakech</span>
            <h1 className="mt-6 font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-foreground">
              {sector.title}
            </h1>
            <p className="mt-6 font-serif italic text-xl md:text-2xl text-primary max-w-xl">
              {sector.tagline}
            </p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="mt-8 text-lg text-text-muted leading-relaxed max-w-3xl">
              {sector.intro}
            </p>
          </FadeIn>
          <FadeIn delay={0.25}>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/contact" className="px-8 py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors">
                Demander un devis gratuit
              </Link>
              <a href="https://wa.me/212625461645" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-8 py-4 border border-line rounded-xl text-foreground hover:border-primary/30 transition-colors">
                <HiOutlineChatBubbleLeft className="w-5 h-5 text-green-400" />
                WhatsApp
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-20 bg-surface-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <span className="pill">✕ Le problème</span>
            <h2 className="mt-8 font-serif text-3xl md:text-5xl text-foreground leading-tight">
              Vous perdez des clients chaque jour
            </h2>
          </FadeIn>
          <StaggerContainer className="mt-12 grid md:grid-cols-3 gap-6">
            {sector.pain.map((p, i) => (
              <StaggerItem key={i}>
                <div className="p-6 border border-red-500/20 bg-red-500/5 rounded-xl">
                  <span className="text-red-400 font-mono text-sm">0{i + 1}</span>
                  <p className="mt-3 text-text-muted leading-relaxed">{p}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-24 bg-background overflow-hidden">
        <div className="grid-bg" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <FadeIn>
              <span className="pill">◆ La solution</span>
              <h2 className="mt-8 font-serif text-3xl md:text-5xl text-foreground leading-tight">
                Ce que votre site inclut
              </h2>
            </FadeIn>
            <StaggerContainer className="space-y-4">
              {sector.features.map((feat) => (
                <StaggerItem key={feat}>
                  <div className="flex items-start gap-4 p-5 border border-line rounded-xl bg-surface-2 hover:border-primary/30 transition-colors">
                    <HiOutlineCheck className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-text-muted leading-relaxed">{feat}</span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="relative py-24 bg-surface-2 overflow-hidden">
        <div className="glow w-[600px] h-[600px] bg-accent top-[30%] right-[-100px] opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <span className="pill">→ Comment ça marche</span>
            <h2 className="mt-8 font-serif text-3xl md:text-5xl text-foreground leading-tight mb-16">
              3 étapes simples
            </h2>
          </FadeIn>
          <StaggerContainer className="grid md:grid-cols-3 gap-8">
            {sector.steps.map((step, i) => (
              <StaggerItem key={i}>
                <div className="relative flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-full border border-primary text-primary bg-background flex items-center justify-center font-mono text-sm">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="font-serif text-2xl text-foreground">{step.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{step.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <span className="pill">? Questions fréquentes</span>
            <h2 className="mt-8 font-serif text-3xl md:text-5xl text-foreground leading-tight mb-12">
              FAQ
            </h2>
          </FadeIn>
          <StaggerContainer className="space-y-6">
            {sector.faq.map((f, i) => (
              <StaggerItem key={i}>
                <div className="border border-line rounded-xl p-6">
                  <h3 className="font-semibold text-foreground mb-3">{f.q}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{f.a}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary">
        <FadeIn className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-4xl md:text-6xl text-background leading-tight">
            {sector.cta}
          </h2>
          <p className="mt-4 text-lg text-background/70">Devis gratuit en 24h — aucun engagement</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/contact" className="px-10 py-4 bg-background text-foreground rounded-xl font-semibold hover:bg-background/90 transition-colors">
              Demander un devis
            </Link>
            <a href="https://wa.me/212625461645" target="_blank" rel="noopener noreferrer" className="px-10 py-4 border-2 border-background/30 text-background rounded-xl font-semibold hover:border-background/60 transition-colors">
              WhatsApp →
            </a>
          </div>
        </FadeIn>
      </section>
    </>
  );
}
