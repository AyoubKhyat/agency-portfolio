/**
 * Seed the Sales Playbook with 5 outreach templates and ~12 sales scripts.
 * Idempotent — templates upsert by key, scripts skip if same category+title already exists.
 *
 * Run: npx tsx prisma/seed-sales-playbook.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const TEMPLATES = [
  {
    key: "INTRO",
    name: "General introduction (FR)",
    channel: "WHATSAPP",
    body: `Bonjour {{name}} 👋

Je suis Ayoub d'Ibda3 Digital, agence web à Marrakech.

Je suis tombé sur votre activité dans le secteur {{sector}} à {{city}} et j'ai trouvé votre approche intéressante.

J'aide les entreprises comme la vôtre à mieux convertir en ligne (site web, automatisation, CRM).

Est-ce que je peux vous partager 2-3 idées rapides pour {{name}} ?`,
    notes: "Use as a first contact — light, no pitch, ask permission.",
  },
  {
    key: "WEBSITE_OFFER",
    name: "Website offer (FR)",
    channel: "WHATSAPP",
    body: `Bonjour {{name}},

Je suis Ayoub d'Ibda3 Digital. J'ai regardé la présence en ligne de {{name}} dans le secteur {{sector}}.

Un site web pro permettrait à vos clients de :
• Vous trouver sur Google
• Réserver/contacter en 1 clic
• Renforcer votre crédibilité

Nous livrons un site sur-mesure en 2-3 semaines, optimisé SEO et mobile.

Vous voulez voir 2-3 exemples qu'on a fait à Marrakech ?`,
    notes: "For prospects without a website. Lead with concrete outcomes.",
  },
  {
    key: "AUTOMATION_OFFER",
    name: "Automation offer (FR)",
    channel: "WHATSAPP",
    body: `Bonjour {{name}},

Beaucoup d'entreprises {{sector}} à {{city}} perdent du temps sur des tâches répétitives : devis, relances, factures, prises de RDV...

Chez Ibda3 Digital on installe des automatisations qui prennent en charge tout ça (WhatsApp, email, agenda, paiement).

Résultat type : -5h/semaine de tâches manuelles, et 0 client oublié.

Est-ce que ça vaut le coup qu'on en parle 15 min ?`,
    notes: "For prospects already running a real business — focus on time saved.",
  },
  {
    key: "CRM_OFFER",
    name: "CRM offer (FR)",
    channel: "WHATSAPP",
    body: `Bonjour {{name}},

Question rapide : comment vous gérez vos prospects et clients aujourd'hui ? (Excel, WhatsApp, mémoire ?)

Pour un {{sector}} qui veut grandir, un CRM simple permet de :
• Ne perdre aucun lead
• Relancer au bon moment
• Voir d'où viennent les meilleurs clients

On a une solution clé en main, en français, en 7 jours.

Ça vous intéresserait d'avoir 5 minutes de démo ?`,
    notes: "Best after qualifying that they have lead-management pain.",
  },
  {
    key: "AI_ASSISTANT_OFFER",
    name: "AI assistant offer (FR)",
    channel: "WHATSAPP",
    body: `Bonjour {{name}},

On vient de déployer un assistant WhatsApp/IA pour un client {{sector}} : il répond aux questions clients 24/7, prend les RDV, et envoie les confirmations — sans intervention humaine.

Résultat : +40% de demandes traitées, 0 message perdu la nuit.

Pour {{name}}, ça pourrait s'installer en 5-7 jours.

Vous voulez voir une démo de 3 min ?`,
    notes: "Newest offer — use for prospects already comfortable with tech.",
  },
];

const SCRIPTS = [
  // WhatsApp openers
  {
    category: "WHATSAPP",
    title: "Compliment + question (FR)",
    body: `Bonjour {{name}},
J'ai vu votre Instagram — la dernière publication sur [détail spécifique] m'a marqué.
Question rapide : est-ce que vous trouvez {{sector}} compliqué de gérer les demandes par WhatsApp ?`,
    tags: "opener,whatsapp,personalized",
  },
  {
    category: "WHATSAPP",
    title: "Direct value (FR)",
    body: `Bonjour {{name}},
Ayoub d'Ibda3 Digital. J'aide les {{sector}} à Marrakech à doubler leurs demandes en ligne. 30 secondes pour vous expliquer ?`,
    tags: "opener,whatsapp,direct",
  },
  {
    category: "WHATSAPP",
    title: "Soft re-engagement after silence (FR)",
    body: `Bonjour {{name}},
Pour info — on vient de livrer un projet pour une {{sector}} à Marrakech, résultat très positif.
Si vous êtes ouvert à en discuter, je peux vous envoyer un exemple 👍`,
    tags: "followup,reengage,whatsapp",
  },

  // Instagram DMs
  {
    category: "INSTAGRAM_DM",
    title: "Story reply hook",
    body: `Salut ! Je viens de voir votre story sur [sujet]. Vraiment cool.
Petite question : c'est vous qui gérez Instagram et WhatsApp pour {{name}} ?`,
    tags: "opener,instagram,story",
  },
  {
    category: "INSTAGRAM_DM",
    title: "Audit-based intro",
    body: `Hello ! J'ai regardé le compte Instagram de {{name}}. J'ai 3 idées rapides pour augmenter les demandes de devis depuis le profil.
Ça vous intéresse que je les partage en DM ?`,
    tags: "opener,instagram,audit",
  },
  {
    category: "INSTAGRAM_DM",
    title: "Compliment + pivot",
    body: `Beau travail sur le branding ! Je suis Ayoub d'Ibda3 Digital, on fait des sites web pro pour les {{sector}} à Marrakech.
Vous avez déjà un site qui complète Instagram ?`,
    tags: "opener,instagram,compliment",
  },

  // Calls
  {
    category: "CALL",
    title: "Cold call — 30-second opener",
    body: `Bonjour {{name}}, c'est Ayoub d'Ibda3 Digital — agence web à Marrakech.
Je vous appelle parce qu'on travaille avec plusieurs {{sector}} dans la ville, et on a remarqué que [insight spécifique].
J'ai 30 secondes pour vous expliquer pourquoi je vous appelle, puis vous me dites si ça vous intéresse — d'accord ?`,
    tags: "opener,call,cold",
  },
  {
    category: "CALL",
    title: "Discovery — first qualifier",
    body: `Pour bien comprendre : aujourd'hui, comment les nouveaux clients trouvent {{name}} ? (Bouche-à-oreille / Instagram / Google / passants ?)
Et sur 10 personnes qui demandent un devis, combien deviennent clients ?`,
    tags: "discovery,call,qualify",
  },

  // Objection handling
  {
    category: "OBJECTION_HANDLING",
    title: "Trop cher",
    body: `Je comprends. La question importante n'est pas le prix mais le ROI : un site bien fait coûte X et rapporte X×3 en 6 mois grâce aux demandes Google.
Si on regarde ensemble ce que ça représente pour {{name}}, ça vaut la peine ?
Et on a aussi des paiements en 3-4 fois.`,
    tags: "objection,too_expensive,price",
  },
  {
    category: "OBJECTION_HANDLING",
    title: "Pas intéressé",
    body: `Pas de souci, je comprends. Juste pour ma curiosité : est-ce que c'est le moment qui n'est pas bon, ou est-ce qu'il y a un sujet précis (site, ventes, équipe) qui vous bloque actuellement ?
Si je tombe juste, je peux vous envoyer 2-3 idées sans engagement.`,
    tags: "objection,not_interested",
  },
  {
    category: "OBJECTION_HANDLING",
    title: "On a déjà un site",
    body: `Super ! La plupart des sites qu'on voit ont un vrai potentiel inexploité (vitesse, SEO local, conversions). On peut vous faire un audit gratuit en 24h — 7 points concrets à améliorer.
Vous voulez le recevoir ?`,
    tags: "objection,already_have_website",
  },
  {
    category: "OBJECTION_HANDLING",
    title: "Rappelez-moi plus tard",
    body: `Sans problème. Pour ne pas vous embêter inutilement : c'est plutôt dans 1 semaine, 2 semaines, ou un mois ?
Je note dans mon agenda et je vous recontacte précisément à ce moment-là.`,
    tags: "objection,call_later",
  },
];

async function main() {
  console.log("Seeding Sales Playbook...");

  // Templates: upsert by key
  for (const t of TEMPLATES) {
    await prisma.outreachTemplate.upsert({
      where: { key: t.key },
      update: { name: t.name, channel: t.channel, body: t.body, notes: t.notes },
      create: { ...t, language: "fr" },
    });
    console.log(`  template ${t.key}`);
  }

  // Scripts: skip if same category+title exists
  for (const s of SCRIPTS) {
    const existing = await prisma.salesScript.findFirst({
      where: { category: s.category, title: s.title },
    });
    if (existing) {
      console.log(`  script ${s.category}/${s.title} (exists)`);
      continue;
    }
    await prisma.salesScript.create({ data: { ...s, language: "fr" } });
    console.log(`  script ${s.category}/${s.title}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
