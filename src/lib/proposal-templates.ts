/**
 * French proposal templates for each service type.
 *
 * Used as a fallback when no AI API key is configured.
 * Templates dynamically reference the prospect name and sector.
 */

export type ServiceType =
  | "website"
  | "ecommerce"
  | "mobile"
  | "seo"
  | "maintenance"
  | "branding"
  | "chatbot"
  | "whatsapp"
  | "webapp"
  | "social";

type TemplateData = {
  packageName: string;
  intro: string;
  scope: string;
  timeline: string;
  paymentTerms: string;
};

type TemplateContext = {
  prospectName: string;
  sector: string;
  budget?: string;
  notes?: string;
};

const templates: Record<ServiceType, (ctx: TemplateContext) => TemplateData> = {
  website: (ctx) => ({
    packageName: "Site Vitrine Premium",
    intro: `Cher(e) ${ctx.prospectName},\n\nNous avons le plaisir de vous soumettre notre proposition pour la conception et le developpement de votre site web vitrine. En tant qu'acteur du secteur "${ctx.sector}", votre presence en ligne est un levier essentiel pour attirer de nouveaux clients et renforcer votre credibilite professionnelle.\n\nChez Ibda3 Digital, nous concevons des sites modernes, rapides et optimises pour le mobile, qui refletent l'identite unique de votre entreprise.`,
    scope: `- Design UI/UX sur mesure avec maquettes Figma (2 iterations incluses)\n- Developpement responsive (desktop, tablette, mobile)\n- Integration de vos contenus (textes, images, videos)\n- Formulaire de contact avec notifications par email\n- Bouton WhatsApp flottant pour contact direct\n- Optimisation des performances (score PageSpeed > 90)\n- Hebergement et mise en ligne\n- Formation a la gestion du contenu (1 session)`,
    timeline: "2-3 semaines",
    paymentTerms: "50% a la signature, 50% a la livraison",
  }),

  ecommerce: (ctx) => ({
    packageName: "Boutique E-commerce",
    intro: `Cher(e) ${ctx.prospectName},\n\nNous sommes ravis de vous presenter notre offre pour la creation de votre boutique en ligne. Le secteur "${ctx.sector}" offre un potentiel considerable pour la vente en ligne, et nous souhaitons vous accompagner dans cette transformation digitale.\n\nIbda3 Digital vous propose une solution e-commerce complete, securisee et facile a gerer au quotidien.`,
    scope: `- Design e-commerce professionnel et adapte a votre marque\n- Catalogue produits avec gestion des categories, variantes et stock\n- Systeme de panier et tunnel de commande optimise\n- Integration des moyens de paiement (carte bancaire, virement, cash on delivery)\n- Gestion des commandes et notifications automatiques\n- Tableau de bord pour le suivi des ventes et statistiques\n- SEO de base pour le referencement des produits\n- Formation complete a l'administration de la boutique`,
    timeline: "4-6 semaines",
    paymentTerms: "40% a la signature, 30% a la validation du design, 30% a la livraison",
  }),

  mobile: (ctx) => ({
    packageName: "Application Mobile",
    intro: `Cher(e) ${ctx.prospectName},\n\nNous avons le plaisir de vous proposer le developpement d'une application mobile pour votre activite dans le secteur "${ctx.sector}". Une application dediee vous permettra d'offrir une experience utilisateur optimale et de fideliser votre clientele.\n\nNotre equipe concoit des applications performantes, intuitives et deployees sur iOS et Android.`,
    scope: `- Analyse fonctionnelle et cahier des charges detaille\n- Design UI/UX mobile natif (maquettes interactives)\n- Developpement cross-platform (React Native / Flutter)\n- Backend et API pour la gestion des donnees\n- Systeme d'authentification utilisateurs\n- Notifications push\n- Tests sur les principaux appareils\n- Publication sur App Store et Google Play\n- Support technique post-lancement (1 mois)`,
    timeline: "6-10 semaines",
    paymentTerms: "30% a la signature, 30% au milestone design, 40% a la livraison",
  }),

  seo: (ctx) => ({
    packageName: "SEO & Referencement",
    intro: `Cher(e) ${ctx.prospectName},\n\nPour renforcer la visibilite de votre entreprise dans le secteur "${ctx.sector}", nous vous proposons un accompagnement SEO complet. Le referencement naturel est le moyen le plus rentable et durable pour attirer des clients qualifies via Google.\n\nIbda3 Digital deploie une strategie SEO adaptee a votre marche local et a vos objectifs de croissance.`,
    scope: `- Audit technique complet de votre site web\n- Recherche et strategie de mots-cles pour le secteur "${ctx.sector}"\n- Optimisation on-page (titres, meta, contenu, structure)\n- Creation et optimisation de votre fiche Google Business Profile\n- Strategie de contenu (recommandations editoriales)\n- Link building et citations locales\n- Rapport mensuel de positionnement et trafic\n- Recommandations d'amelioration continues`,
    timeline: "Engagement 3 mois minimum (resultats significatifs a partir du 2e mois)",
    paymentTerms: "Forfait mensuel, paiement en debut de mois",
  }),

  maintenance: (ctx) => ({
    packageName: "Maintenance & Support",
    intro: `Cher(e) ${ctx.prospectName},\n\nPour garantir la perennite et la performance de votre presence digitale dans le secteur "${ctx.sector}", nous vous proposons un contrat de maintenance et support technique.\n\nIbda3 Digital assure la surveillance, la mise a jour et le bon fonctionnement continu de vos outils web.`,
    scope: `- Mises a jour de securite et techniques (CMS, plugins, dependances)\n- Sauvegardes automatiques regulieres\n- Surveillance de la disponibilite (uptime monitoring)\n- Corrections de bugs et ajustements mineurs\n- Support technique par email et WhatsApp (reponse sous 24h)\n- Rapport mensuel de sante du site\n- 2 heures de modifications mineures par mois incluses`,
    timeline: "Contrat annuel avec facturation mensuelle",
    paymentTerms: "Paiement mensuel, engagement 6 mois minimum",
  }),

  branding: (ctx) => ({
    packageName: "Identite Visuelle & Branding",
    intro: `Cher(e) ${ctx.prospectName},\n\nNous souhaitons vous accompagner dans la creation d'une identite visuelle forte et coherente pour votre entreprise dans le secteur "${ctx.sector}". Une image de marque professionnelle est fondamentale pour vous demarquer de la concurrence.\n\nIbda3 Digital cree des identites visuelles memorables et adaptees a tous vos supports.`,
    scope: `- Recherche et benchmark concurrentiel\n- Conception du logo (3 propositions, 2 iterations)\n- Charte graphique complete (couleurs, typographies, usage)\n- Declinaison sur supports digitaux (reseaux sociaux, email)\n- Declinaison sur supports print (carte de visite, en-tete)\n- Fichiers source en haute resolution (AI, PDF, PNG, SVG)`,
    timeline: "1-2 semaines",
    paymentTerms: "50% a la signature, 50% a la validation finale",
  }),

  chatbot: (ctx) => ({
    packageName: "Assistant IA & Chatbot",
    intro: `Cher(e) ${ctx.prospectName},\n\nNous vous proposons l'integration d'un assistant intelligent (chatbot IA) pour votre entreprise dans le secteur "${ctx.sector}". Un chatbot bien configure peut repondre automatiquement aux questions frequentes, qualifier les prospects et ameliorer considerablement l'experience client.\n\nIbda3 Digital deploie des solutions IA modernes et adaptees a votre metier.`,
    scope: `- Analyse des scenarios de conversation et FAQ\n- Configuration et entrainement du chatbot sur votre secteur\n- Integration sur votre site web et/ou WhatsApp\n- Reponses automatiques personnalisees en francais et arabe\n- Tableau de bord pour suivre les conversations\n- Transfert automatique vers un humain si necessaire\n- Phase de test et ajustements`,
    timeline: "2-3 semaines",
    paymentTerms: "50% a la signature, 50% a la livraison",
  }),

  whatsapp: (ctx) => ({
    packageName: "Automatisation WhatsApp",
    intro: `Cher(e) ${ctx.prospectName},\n\nNous vous proposons de mettre en place une solution d'automatisation WhatsApp pour votre activite dans le secteur "${ctx.sector}". WhatsApp etant l'outil de communication le plus utilise au Maroc, automatiser vos echanges vous fera gagner un temps precieux.\n\nIbda3 Digital configure des workflows WhatsApp professionnels et efficaces.`,
    scope: `- Configuration de WhatsApp Business API\n- Messages de bienvenue et reponses automatiques\n- Workflows de qualification de leads\n- Notifications automatiques (commandes, rendez-vous)\n- Integration avec votre CRM ou site web\n- Templates de messages valides par WhatsApp\n- Formation a l'utilisation`,
    timeline: "1-2 semaines",
    paymentTerms: "50% a la signature, 50% a la livraison",
  }),

  webapp: (ctx) => ({
    packageName: "Application Web Sur Mesure",
    intro: `Cher(e) ${ctx.prospectName},\n\nNous avons le plaisir de vous proposer le developpement d'une application web sur mesure pour repondre aux besoins specifiques de votre entreprise dans le secteur "${ctx.sector}". Une application dediee vous permettra d'optimiser vos processus et d'offrir un meilleur service a vos clients.\n\nIbda3 Digital concoit des applications web robustes, securisees et evolutives.`,
    scope: `- Analyse fonctionnelle et specification technique\n- Architecture et conception de la base de donnees\n- Developpement frontend et backend\n- Systeme d'authentification et gestion des roles\n- Tableau de bord et reporting\n- API pour integrations tierces\n- Tests complets et recette\n- Deploiement et hebergement\n- Documentation technique et formation`,
    timeline: "6-10 semaines",
    paymentTerms: "30% a la signature, 30% au milestone intermediaire, 40% a la livraison",
  }),

  social: (ctx) => ({
    packageName: "Design Reseaux Sociaux",
    intro: `Cher(e) ${ctx.prospectName},\n\nPour renforcer votre presence sur les reseaux sociaux dans le secteur "${ctx.sector}", nous vous proposons un service de creation de contenu visuel professionnel. Des visuels attractifs et coherents sont essentiels pour capter l'attention et engager votre audience.\n\nIbda3 Digital cree des contenus visuels percutants et adaptes a chaque plateforme.`,
    scope: `- Creation de templates de publications (Instagram, Facebook, LinkedIn)\n- Couvertures et avatars optimises par plateforme\n- Pack de 10 visuels par mois (stories, posts, carousels)\n- Charte graphique reseaux sociaux\n- Formats adaptes a chaque plateforme\n- Fichiers source editables`,
    timeline: "1 semaine pour le setup initial, puis production mensuelle",
    paymentTerms: "Forfait mensuel, paiement en debut de mois",
  }),
};

/**
 * Map proposal-builder service names to template keys.
 */
const SERVICE_KEY_MAP: Record<string, ServiceType> = {
  "Website Vitrine": "website",
  "E-commerce": "ecommerce",
  "Branding": "branding",
  "SEO Local": "seo",
  "Social Media Design": "social",
  "AI Chatbot": "chatbot",
  "WhatsApp Automation": "whatsapp",
  "Custom Web App": "webapp",
  "Maintenance": "maintenance",
};

/**
 * Detect the primary service type from a services string (comma-separated).
 */
export function detectServiceType(services: string): ServiceType {
  const normalized = services.toLowerCase();

  // Check for specific keywords in priority order
  if (normalized.includes("e-commerce") || normalized.includes("ecommerce") || normalized.includes("boutique")) return "ecommerce";
  if (normalized.includes("mobile") || normalized.includes("app mobile") || normalized.includes("ios") || normalized.includes("android")) return "mobile";
  if (normalized.includes("chatbot") || normalized.includes("ai chat") || normalized.includes("assistant ia")) return "chatbot";
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("custom web app") || normalized.includes("web app") || normalized.includes("application web")) return "webapp";
  if (normalized.includes("seo") || normalized.includes("referencement")) return "seo";
  if (normalized.includes("maintenance") || normalized.includes("support")) return "maintenance";
  if (normalized.includes("branding") || normalized.includes("identite") || normalized.includes("logo")) return "branding";
  if (normalized.includes("social media") || normalized.includes("reseaux sociaux")) return "social";
  if (normalized.includes("website") || normalized.includes("site") || normalized.includes("vitrine")) return "website";

  return "website"; // Default fallback
}

/**
 * Generate a proposal from templates (no AI needed).
 */
export function generateFromTemplate(input: {
  prospectName: string;
  sector: string;
  services: string;
  budget?: string;
  notes?: string;
}): {
  packageName: string;
  services: string;
  timeline: string;
  paymentTerms: string;
  notes: string;
} {
  const serviceType = detectServiceType(input.services);
  const ctx: TemplateContext = {
    prospectName: input.prospectName,
    sector: input.sector,
    budget: input.budget,
    notes: input.notes,
  };

  const template = templates[serviceType](ctx);

  // Build the complete proposal text for the notes field
  const proposalNotes = [
    template.intro,
    "",
    "--- PRESTATIONS INCLUSES ---",
    template.scope,
  ];

  if (input.budget) {
    proposalNotes.push("", `Budget indicatif du client : ${input.budget} MAD`);
  }

  if (input.notes) {
    proposalNotes.push("", `Notes complementaires : ${input.notes}`);
  }

  proposalNotes.push(
    "",
    "--- PROPOSITION DE VALEUR ---",
    `En choisissant Ibda3 Digital, vous beneficiez d'une equipe passionnee, reactive et basee a Marrakech. Nous vous accompagnons de A a Z, de la conception a la mise en ligne, avec un suivi personnalise et transparent.`,
    "",
    `Nous restons a votre disposition pour un appel decouverte ou une reunion de cadrage. N'hesitez pas a nous contacter par WhatsApp au +212 625 461 645.`,
    "",
    "Cordialement,",
    "L'equipe Ibda3 Digital"
  );

  return {
    packageName: template.packageName,
    services: input.services,
    timeline: template.timeline,
    paymentTerms: template.paymentTerms,
    notes: proposalNotes.join("\n"),
  };
}

export { SERVICE_KEY_MAP, templates };
export type { TemplateContext };
