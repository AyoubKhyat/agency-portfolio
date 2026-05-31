import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const prospects = [
  // ==================== IMMOBILIER (20) ====================
  { name: "Sophia Immo Marrakech", phone: "0721964028", sector: "Immobilier", neighborhood: "Marrakech", instagram: "@sophia_immo_marrakech", hasWebsite: false, note: "Site Webador basique, pas de vrai site pro — parfait prospect" },
  { name: "Sélection Agenz Marrakech", phone: "0665352431", sector: "Immobilier", neighborhood: "Marrakech", instagram: "", hasWebsite: false, note: "160 annonces sur Agenz, note 5/5 — pas de site propre" },
  { name: "Prestige Living", phone: "0661464348", sector: "Immobilier", neighborhood: "Gueliz", instagram: "", hasWebsite: true, note: "Site basique, Atlas Center Premium. Luxe, prestige" },
  { name: "R2C Immobilier", phone: "0618187196", sector: "Immobilier", neighborhood: "Médina", instagram: "", hasWebsite: true, note: "Site daté. Palmeraie, Guéliz, Hivernage, Médina" },
  { name: "Marrakech Connexion", phone: "0661448107", sector: "Immobilier", neighborhood: "Gueliz", instagram: "", hasWebsite: true, note: "Site ancien. Vente, achat, location, gestion" },
  { name: "Mur & Prestige", phone: "0660028665", sector: "Immobilier", neighborhood: "Hivernage", instagram: "@muretprestigeproperties", hasWebsite: true, note: "10 ans luxe, 484 followers IG — site basique pour son standing" },
  { name: "Realty Invest Morocco", phone: "0619300094", sector: "Immobilier", neighborhood: "Marrakech", instagram: "@realty_investment_morocco", hasWebsite: true, note: "Site très simple. Investissement immobilier, 7j/7" },
  { name: "MC Agency Marrakech", phone: "0684505722", sector: "Immobilier", neighborhood: "Gueliz", instagram: "@mcagency_marrakech", hasWebsite: true, note: "Fondateur Mehdi Cherrak 90K followers perso. Expats, investisseurs" },
  { name: "FJ Morocco Agency", phone: "0666623918", sector: "Immobilier", neighborhood: "Gueliz", instagram: "@fjmoroccoagency_", hasWebsite: true, note: "15 ans expérience franco-marocaine. Luxe. YouTube actif" },
  { name: "FOCH Real Estate", phone: "0610102924", sector: "Immobilier", neighborhood: "Gueliz", instagram: "@fochmarrakech", hasWebsite: true, note: "72K followers IG! Très actif digital. Vente, location, VEFA" },
  { name: "KNA Immobilier", phone: "0694200600", sector: "Immobilier", neighborhood: "Hivernage", instagram: "@kna.immobilier.marrakech", hasWebsite: true, note: "11K IG. Luxe, villas, riads. Multilingue. Fondée 2014" },
  { name: "BKS Immobilier", phone: "0663563747", sector: "Immobilier", neighborhood: "Gueliz", instagram: "", hasWebsite: true, note: "Membre AMAI. 212 Avenue Mohamed V" },
  { name: "Côté Médina Immobilier", phone: "0663447424", sector: "Immobilier", neighborhood: "Médina", instagram: "@agence_cote_medina", hasWebsite: true, note: "Spécialisée riads médina depuis 2009" },
  { name: "Luxe & Prestige Marrakech", phone: "0652309701", sector: "Immobilier", neighborhood: "Gueliz", instagram: "@luxe_prestige_marrakech", hasWebsite: true, note: "Palmeraie, Targa, Semlalia. Fondée par Daphné" },
  { name: "Prestige Gallery Immo", phone: "0661708041", sector: "Immobilier", neighborhood: "Bd Mohamed VI", instagram: "@nabil_prestigeimmo.ma", hasWebsite: true, note: "121 annonces Agenz. Luxe" },
  { name: "Etoile de Marrakech Immobilier", phone: "0601658992", sector: "Immobilier", neighborhood: "Gueliz", instagram: "", hasWebsite: true, note: "Location longue durée clientèle internationale" },
  { name: "In Marrakech Immobilier", phone: "0662067011", sector: "Immobilier", neighborhood: "Gueliz", instagram: "", hasWebsite: true, note: "Fondée par Asmaa Charafane. Vente, location, déco intérieure" },
  { name: "Promo Immo Marrakech", phone: "0661825359", sector: "Immobilier", neighborhood: "Gueliz", instagram: "@promoimmomarrakech", hasWebsite: true, note: "Guéliz, Hivernage, Palmeraie, Médina" },
  { name: "LYZ Marrakech Immobilier", phone: "0663506568", sector: "Immobilier", neighborhood: "Agdal", instagram: "@lyzmarrakechservices", hasWebsite: true, note: "Agdal, Guéliz, Route Ourika" },
  { name: "Luxavia Marrakech", phone: "0661551199", sector: "Immobilier", neighborhood: "Bd Mohamed VI", instagram: "@luxaviamarrakech", hasWebsite: true, note: "Groupe DIVA AAKAR, 20 ans. Promoteur + agence" },

  // ==================== CENTRE DE FORMATION (8) ====================
  { name: "École Racine Guéliz", phone: "0524447306", sector: "Centre de Formation", neighborhood: "Gueliz", instagram: "", hasWebsite: true, note: "Depuis 1985. Informatique, gestion, finance, tourisme, design 3D" },
  { name: "CPLI Formation", phone: "0524448953", sector: "Centre de Formation", neighborhood: "Gueliz", instagram: "", hasWebsite: true, note: "Langues + certifications internationales. cpliformation.com" },
  { name: "ECOSTIG", phone: "0524449391", sector: "Centre de Formation", neighborhood: "Bab Doukkala", instagram: "", hasWebsite: true, note: "Depuis 1997. Diplômes accrédités + FEDE + MOS" },
  { name: "Centre Arraid", phone: "0524392191", sector: "Centre de Formation", neighborhood: "Massira", instagram: "", hasWebsite: true, note: "Diplômes TS, TH, Licences FEDE" },
  { name: "CCFP Marrakech", phone: "0607403030", sector: "Centre de Formation", neighborhood: "Bab Doukkala", instagram: "", hasWebsite: true, note: "Centre de Certification et Formation Professionnelle" },
  { name: "EHPM Marrakech", phone: "0524420506", sector: "Centre de Formation", neighborhood: "Gueliz", instagram: "@ehpmschool", hasWebsite: true, note: "École hôtelière: cuisine, pâtisserie, hôtesse de l'air" },
  { name: "Centre Polyetude", phone: "0665681764", sector: "Centre de Formation", neighborhood: "Médina", instagram: "", hasWebsite: false, note: "IT, langues, comptabilité, soutien scolaire — PAS DE SITE" },
  { name: "Visa School Marrakech", phone: "0524432145", sector: "Centre de Formation", neighborhood: "Marrakech", instagram: "", hasWebsite: true, note: "Multi-filières: technicien, infirmier, MBA, langues, graphisme" },

  // ==================== CLINIQUE / CABINET MÉDICAL (5) ====================
  { name: "Clinique Internationale de Marrakech", phone: "0524369595", sector: "Clinique / Cabinet Médical", neighborhood: "Route Aéroport", instagram: "", hasWebsite: true, note: "Grande clinique multi-spécialités" },
  { name: "Clinique Grand Atlas", phone: "0524393900", sector: "Clinique / Cabinet Médical", neighborhood: "Targa", instagram: "", hasWebsite: true, note: "21 spécialités, 24h/24" },
  { name: "Clinique ERRAHMA", phone: "0524343461", sector: "Clinique / Cabinet Médical", neighborhood: "Targa", instagram: "@clinique_errahma_marrakech", hasWebsite: true, note: "21 spécialités, 24h/24" },
  { name: "Hôpital Privé de Marrakech", phone: "0524359800", sector: "Clinique / Cabinet Médical", neighborhood: "Route du Barrage", instagram: "", hasWebsite: true, note: "Grande clinique privée" },
  { name: "Clinique Ibn Tofail", phone: "0524438718", sector: "Clinique / Cabinet Médical", neighborhood: "Gueliz", instagram: "", hasWebsite: false, note: "Quartier de l'Hôpital Guéliz — PAS DE SITE" },

  // ==================== DÉCORATION / MEUBLES (6) ====================
  { name: "BD Création & Design", phone: "0661980038", sector: "Décoration / Meubles", neighborhood: "Gueliz", instagram: "@bd.creation.design", hasWebsite: true, note: "Architecture + déco intérieure depuis 2010" },
  { name: "Kech Design", phone: "0524200046", sector: "Décoration / Meubles", neighborhood: "Sidi Ghanem", instagram: "@kechdesignn", hasWebsite: true, note: "Leader aménagement intérieur. Cuisines, dressings, bureaux" },
  { name: "Soft Life Deco", phone: "0660540062", sector: "Décoration / Meubles", neighborhood: "Sidi Ghanem", instagram: "@soft_lifedeco", hasWebsite: true, note: "Meubles de luxe sur mesure" },
  { name: "The Teak House Marrakech", phone: "0524356336", sector: "Décoration / Meubles", neighborhood: "Sidi Ghanem", instagram: "", hasWebsite: false, note: "Ameublement + agencement — PAS DE SITE" },
  { name: "Carré Meubles", phone: "0524336630", sector: "Décoration / Meubles", neighborhood: "Sidi Ghanem", instagram: "", hasWebsite: false, note: "Meubles décoratifs + artisanat — PAS DE SITE" },
  { name: "Menuiserie Azeroual", phone: "0524335968", sector: "Décoration / Meubles", neighborhood: "Sidi Ghanem", instagram: "", hasWebsite: false, note: "Menuiserie luxe, ébénisterie, décoration — PAS DE SITE" },

  // ==================== GARAGE AUTO / LOCATION (7) ====================
  { name: "RPM Garage Marrakech", phone: "0524358194", sector: "Garage Auto", neighborhood: "Sidi Ghanem", instagram: "@rpmgarage.marrakech", hasWebsite: true, note: "Multi-marques haut de gamme, spécialiste Porsche. 30+ ans" },
  { name: "Smart Auto Moto", phone: "0666885013", sector: "Garage Auto", neighborhood: "Zone Industrielle", instagram: "@smartautomoto", hasWebsite: true, note: "Mécanique, pneus, carrosserie, occasion. 7j/7" },
  { name: "Garage Auto Pro", phone: "0672057286", sector: "Garage Auto", neighborhood: "Mhamid", instagram: "", hasWebsite: true, note: "15 ans d'expérience. mecaniquemarrakech.com" },
  { name: "OyamaCar Marrakech", phone: "0673724646", sector: "Garage Auto", neighborhood: "Médina", instagram: "@oyama.car", hasWebsite: true, note: "Location voiture 24h/24" },
  { name: "Go Rent Car Marrakech", phone: "0664342254", sector: "Garage Auto", neighborhood: "Gueliz", instagram: "@gorent.marrakech", hasWebsite: true, note: "Location voiture Guéliz + aéroport" },
  { name: "Majdoline Travel", phone: "0618700526", sector: "Garage Auto", neighborhood: "Médina", instagram: "@majdolinerentcars", hasWebsite: true, note: "Location voiture depuis 2000. Sans intermédiaire" },
  { name: "NCRA Renault Marrakech", phone: "0524301008", sector: "Garage Auto", neighborhood: "Route Casablanca", instagram: "@renault.marrakech", hasWebsite: true, note: "Concessionnaire Renault + Dacia officiel" },

  // ==================== BIJOUTERIE / JOAILLERIE (6) ====================
  { name: "Bijouterie Rafinity", phone: "0524422353", sector: "Bijouterie", neighborhood: "Hivernage", instagram: "@rafinity.marrakech", hasWebsite: true, note: "Or 18K, diamants. The Pearl Hotel" },
  { name: "LEDIAMANTI", phone: "0600928492", sector: "Bijouterie", neighborhood: "Gueliz", instagram: "@lediamanti", hasWebsite: true, note: "Bagues fiançailles sur mesure, diamants certifiés GIA/IGI" },
  { name: "Bijouterie Merveilleuse", phone: "0664181666", sector: "Bijouterie", neighborhood: "Massira", instagram: "@bijouterie.merveilleuse", hasWebsite: false, note: "Joaillerie fine — PAS DE SITE, prospect idéal" },
  { name: "Riad Des Bijoux", phone: "0770417518", sector: "Bijouterie", neighborhood: "Marrakech", instagram: "@riad_des_bijoux", hasWebsite: false, note: "Bijoux artisanaux or 18K fait main — PAS DE SITE" },
  { name: "MADD Bijoutier Joaillier", phone: "", sector: "Bijouterie", neighborhood: "Gueliz", instagram: "@madd.bijoutier.joaillier", hasWebsite: false, note: "4 générations depuis 1977, or 18K — PAS DE SITE" },
  { name: "Yasmina Bijouterie", phone: "", sector: "Bijouterie", neighborhood: "Médina", instagram: "@yasmina.bijouterie", hasWebsite: false, note: "Dar el Bacha, Médina — PAS DE SITE" },

  // ==================== AGENCE DE VOYAGE / TOURISME (8) ====================
  { name: "Menara Tours", phone: "0661389015", sector: "Agence de Voyage", neighborhood: "Gueliz", instagram: "@menaratoursofficial", hasWebsite: true, note: "DMC fondé 1977. Événements corporate, groupes, circuits" },
  { name: "Marrakech Group Tours", phone: "0666277559", sector: "Agence de Voyage", neighborhood: "Gueliz", instagram: "@comingmorocco", hasWebsite: true, note: "Excursions groupe: Essaouira, Ouzoud, Atlas" },
  { name: "Excursions Marrakech", phone: "0614343540", sector: "Agence de Voyage", neighborhood: "Gueliz", instagram: "", hasWebsite: true, note: "Transport touristique depuis 1990, haut de gamme" },
  { name: "Excursion Marrakech", phone: "0661936651", sector: "Agence de Voyage", neighborhood: "Jemaa El Fna", instagram: "@excursions__marrakech", hasWebsite: true, note: "Désert, atlas, activités" },
  { name: "Marrakech Tours Experience", phone: "0661383996", sector: "Agence de Voyage", neighborhood: "Médina", instagram: "", hasWebsite: true, note: "Circuits désert Merzouga/Zagora, quad, moto" },
  { name: "Habti Voyages", phone: "0524431250", sector: "Agence de Voyage", neighborhood: "Gueliz", instagram: "", hasWebsite: false, note: "159 Bd Mohammed V — PAS DE SITE" },
  { name: "Adrar Aventure", phone: "0524435663", sector: "Agence de Voyage", neighborhood: "Menara", instagram: "", hasWebsite: false, note: "Excursions et aventure — PAS DE SITE" },
  { name: "Itinerance Plus", phone: "0688588022", sector: "Agence de Voyage", neighborhood: "Marrakech", instagram: "", hasWebsite: true, note: "Site en maintenance! Circuits désert, Atlas, Fès" },
];

async function main() {
  let created = 0;
  for (const p of prospects) {
    const existing = await prisma.prospect.findFirst({ where: { name: p.name } });
    if (existing) { console.log(`SKIP: ${p.name}`); continue; }

    const phone = p.phone.replace(/^0/, "212");
    const whatsappLink = p.phone ? `https://wa.me/${phone}` : "";

    const prospect = await prisma.prospect.create({
      data: {
        name: p.name, phone: p.phone, whatsappLink,
        sector: p.sector, neighborhood: p.neighborhood || "",
        instagram: p.instagram || "", hasWebsite: p.hasWebsite || false,
        priority: p.phone ? 2 : 1, status: "A_ENVOYER",
      },
    });

    if (p.note) {
      await prisma.prospectNote.create({ data: { prospectId: prospect.id, content: p.note } });
    }
    created++;
  }
  const total = await prisma.prospect.count();
  const withPhone = await prisma.prospect.count({ where: { phone: { not: "" } } });
  const pending = await prisma.prospect.count({ where: { status: "A_ENVOYER" } });
  console.log(`\nBatch 7 seeded ${created} new prospects.`);
  console.log(`Total: ${total} | With phone: ${withPhone} | À envoyer: ${pending}`);
}

main().then(() => prisma.$disconnect());
