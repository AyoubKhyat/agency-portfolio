/**
 * Ibda3 Digital knowledge base for the AI chatbot.
 * Kept intentionally small — the LLM is grounded on this content.
 */

export type Locale = "en" | "fr" | "ar";

export interface Service {
  slug: string;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  startingFromMAD: number;
}

export const AGENCY = {
  name: "Ibda3 Digital",
  location: "Marrakech, Morocco",
  timezone: "GMT+1 (Africa/Casablanca)",
  languages: ["English", "Français", "العربية"],
  whatsapp: "+212 625 461 645",
  whatsappUrl: "https://wa.me/212625461645",
  email: "ibda3.digital0@gmail.com",
  website: "https://ibda3-digital.vercel.app",
  instagram: "https://www.instagram.com/ibda3.digital0/",
  founded: 2022,
} as const;

export const SERVICES: Service[] = [
  {
    slug: "websites",
    name: {
      en: "Websites",
      fr: "Sites web",
      ar: "مواقع الويب",
    },
    description: {
      en: "Modern, responsive showcase sites with SEO optimization. 3D and motion where it fits the brand.",
      fr: "Sites vitrines modernes, responsives, optimisés SEO. 3D et animations quand la marque le justifie.",
      ar: "مواقع عرض حديثة ومتجاوبة مع تحسين محركات البحث. تأثيرات ثلاثية الأبعاد وحركة عند الحاجة.",
    },
    startingFromMAD: 3000,
  },
  {
    slug: "ecommerce",
    name: {
      en: "E-commerce",
      fr: "E-commerce",
      ar: "التجارة الإلكترونية",
    },
    description: {
      en: "Online stores with cart, checkout, admin dashboard, and WhatsApp ordering. Multi-language when needed.",
      fr: "Boutiques en ligne avec panier, paiement, tableau de bord admin, et commande via WhatsApp. Multilingue au besoin.",
      ar: "متاجر إلكترونية مع سلة تسوق، دفع، لوحة تحكم، وطلب عبر واتساب. متعدد اللغات عند الحاجة.",
    },
    startingFromMAD: 6000,
  },
  {
    slug: "mobile-apps",
    name: {
      en: "Mobile Apps",
      fr: "Applications mobiles",
      ar: "تطبيقات الموبايل",
    },
    description: {
      en: "iOS and Android apps with fluid UX. Backend + API included.",
      fr: "Applications iOS et Android avec UX fluide. Backend et API inclus.",
      ar: "تطبيقات iOS و Android مع تجربة مستخدم سلسة. مع الخادم و API.",
    },
    startingFromMAD: 15000,
  },
  {
    slug: "seo",
    name: {
      en: "SEO",
      fr: "SEO",
      ar: "تحسين محركات البحث",
    },
    description: {
      en: "Technical SEO, keyword strategy, and performance optimization to rank on Google.",
      fr: "SEO technique, stratégie de mots-clés et optimisation des performances pour bien se classer sur Google.",
      ar: "تحسين تقني، استراتيجية كلمات مفتاحية، وتحسين الأداء للظهور على جوجل.",
    },
    startingFromMAD: 2000,
  },
  {
    slug: "maintenance",
    name: {
      en: "Maintenance & Support",
      fr: "Maintenance & Support",
      ar: "الصيانة والدعم",
    },
    description: {
      en: "Monthly upkeep, security patches, performance monitoring, and small feature additions.",
      fr: "Maintenance mensuelle, correctifs de sécurité, monitoring de performance et ajouts de fonctionnalités.",
      ar: "صيانة شهرية، ترقيعات أمنية، مراقبة الأداء وإضافة ميزات صغيرة.",
    },
    startingFromMAD: 500,
  },
];

export interface ProjectRef {
  name: string;
  url: string;
  type: string;
}

export const PORTFOLIO: ProjectRef[] = [
  { name: "Hammam Nour", url: "https://hammam-nour.vercel.app/", type: "Spa & wellness booking site" },
  { name: "Goudoukh Luxury Cars", url: "https://goudoukh-luxury-cars.vercel.app/", type: "Car rental with booking flow" },
  { name: "Tannour", url: "https://tannour.vercel.app/", type: "Luxury leather e-commerce" },
  { name: "Aylani Parfums", url: "https://aylani-parfums.vercel.app/", type: "Perfume e-commerce with WhatsApp ordering" },
  { name: "Asrar Lalla", url: "https://asrar-lalla.vercel.app/", type: "Moroccan beauty e-commerce with cash-on-delivery" },
];

export const FAQ: Record<Locale, Array<{ q: string; a: string }>> = {
  en: [
    {
      q: "How long does a project take?",
      a: "Showcase sites: 1–2 weeks. E-commerce: 3–5 weeks. Mobile apps: 6–10 weeks. We give a fixed date once we scope the project.",
    },
    {
      q: "Do you sign an NDA?",
      a: "Yes, at no extra cost.",
    },
    {
      q: "Can we pay in installments?",
      a: "Standard is 40% to start, 30% at midpoint, 30% at delivery.",
    },
    {
      q: "Do you help with hosting?",
      a: "Yes — we set up hosting on Vercel or a VPS, but you own the account.",
    },
    {
      q: "Do you work in French, English, Arabic?",
      a: "Yes, all three languages professionally.",
    },
  ],
  fr: [
    {
      q: "Combien de temps prend un projet ?",
      a: "Sites vitrines : 1–2 semaines. E-commerce : 3–5 semaines. Applications mobiles : 6–10 semaines. Date fixe donnée après le cadrage.",
    },
    {
      q: "Signez-vous un NDA ?",
      a: "Oui, sans frais supplémentaires.",
    },
    {
      q: "Peut-on payer en plusieurs fois ?",
      a: "Standard : 40 % au démarrage, 30 % à mi-parcours, 30 % à la livraison.",
    },
    {
      q: "Vous aidez avec l'hébergement ?",
      a: "Oui — on configure Vercel ou un VPS, mais vous restez propriétaire du compte.",
    },
    {
      q: "Vous travaillez en français, anglais, arabe ?",
      a: "Oui, les trois langues professionnellement.",
    },
  ],
  ar: [
    {
      q: "كم من الوقت يستغرق المشروع؟",
      a: "مواقع العرض: 1-2 أسابيع. التجارة الإلكترونية: 3-5 أسابيع. تطبيقات الموبايل: 6-10 أسابيع. نعطي تاريخاً محدداً بعد تحديد نطاق المشروع.",
    },
    {
      q: "هل توقعون على اتفاقية عدم إفشاء (NDA)؟",
      a: "نعم، بدون تكلفة إضافية.",
    },
    {
      q: "هل يمكن الدفع على أقساط؟",
      a: "المعتاد: 40% عند البدء، 30% في منتصف الطريق، 30% عند التسليم.",
    },
    {
      q: "هل تساعدون في الاستضافة؟",
      a: "نعم — نقوم بإعداد Vercel أو VPS، لكن الحساب يبقى ملككم.",
    },
    {
      q: "هل تعملون بالفرنسية والإنجليزية والعربية؟",
      a: "نعم، بالثلاث لغات باحترافية.",
    },
  ],
};

export function detectLocale(text: string): Locale {
  // simple heuristic for the chatbot; the layout locale is the real source of truth
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/\b(bonjour|salut|merci|projet|site|développeur|entreprise)\b/i.test(text)) return "fr";
  return "en";
}
