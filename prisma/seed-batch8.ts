import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const prospects = [
  // ==================== DENTISTE / CABINET DENTAIRE (10) ====================
  { name: "Cabinet Dentaire Dr. H. Dassouli", phone: "0642647958", sector: "Dentiste", neighborhood: "Mhamid", instagram: "@cabinet_dr_dassouli", hasWebsite: false, note: "12K followers IG, aucun site web — contact uniquement par IG et téléphone" },
  { name: "Harmony Clinic Dentaire", phone: "0525090909", sector: "Dentiste", neighborhood: "Gueliz", instagram: "@clinic_harmony", hasWebsite: false, note: "6.8K followers IG, pas de site web" },
  { name: "Dr El Fadli Imane", phone: "0620022087", sector: "Dentiste", neighborhood: "Gueliz", instagram: "@dentiste.marrakech", hasWebsite: false, note: "3.4K followers IG, praticienne solo sans site" },
  { name: "Centre Dentaire SAMSAH", phone: "0708057363", sector: "Dentiste", neighborhood: "Hay Charaf", instagram: "", hasWebsite: false, note: "Urgences dentaires 24/7, aucun site web ni réseaux sociaux" },
  { name: "Dr Seqqat Dakhma Mohammed", phone: "0654862663", sector: "Dentiste", neighborhood: "El Massira", instagram: "", hasWebsite: false, note: "4.8/5 étoiles, 145 avis AlloMédecin — AUCUN site web" },
  { name: "Dr Laziza Lamchini", phone: "0688813749", sector: "Dentiste", neighborhood: "Gueliz", instagram: "", hasWebsite: false, note: "Orthodontiste / pédodontiste, annuaire uniquement, pas de site" },
  { name: "Dr Hind Benyamna", phone: "0662445511", sector: "Dentiste", neighborhood: "Hivernage", instagram: "", hasWebsite: false, note: "4.7/5, 88 avis AlloMédecin, pas de site web" },
  { name: "Dr Idrissane Charaf", phone: "0689552257", sector: "Dentiste", neighborhood: "Hivernage", instagram: "", hasWebsite: false, note: "4.9/5, 155 avis — TOP rated mais AUCUN site web" },
  { name: "Centre Dentaire Al Amal", phone: "0525127575", sector: "Dentiste", neighborhood: "Hay Massira", instagram: "", hasWebsite: false, note: "4.6/5, 73 avis, Dr Youssef Lahbila — pas de site" },
  { name: "NB Avocats – Nizar Law Office", phone: "0666448698", sector: "Avocat", neighborhood: "Marrakech", instagram: "", hasWebsite: false, note: "Cabinet moderne, seulement une page Facebook — idéal pour refonte" },

  // ==================== SALON BEAUTÉ / COIFFURE (8) ====================
  { name: "Beauty Lab Marrakech", phone: "0524447609", sector: "Salon Beauté", neighborhood: "Gueliz", instagram: "@beautylabmarrakech", hasWebsite: true, note: "21K followers! Site beautylab.ma = 'Coming Soon' — prospect CHAUD" },
  { name: "Inella Salon de Coiffure", phone: "0666373266", sector: "Salon Beauté", neighborhood: "Gueliz", instagram: "@inella_marrakech", hasWebsite: false, note: "Nouveau salon intime, couvert par La Tribune de Marrakech — pas de site" },
  { name: "Salon Mouna Marrakech", phone: "0661301966", sector: "Salon Beauté", neighborhood: "Gueliz", instagram: "@salonmounamarrakech", hasWebsite: false, note: "20+ ans d'activité, IG uniquement" },
  { name: "En Secret Marrakech", phone: "0666686692", sector: "Salon Beauté", neighborhood: "Gueliz", instagram: "@ensecretmarrakech", hasWebsite: false, note: "9.5K followers IG, makeup/nails/hair — pas de site" },
  { name: "Salon Éclat de Beauté", phone: "0661244675", sector: "Salon Beauté", neighborhood: "Al Izdihar", instagram: "@salon_eclat_de_beaute", hasWebsite: false, note: "11K followers IG — pas de site web" },
  { name: "Hafid Tendance Coiffure", phone: "0666528408", sector: "Salon Beauté", neighborhood: "Gueliz", instagram: "@tendance.coiffure.officielle", hasWebsite: false, note: "Facebook + IG only, pas de site pro" },
  { name: "7ème Sens Institut Beauté", phone: "0689022885", sector: "Salon Beauté", neighborhood: "Gueliz", instagram: "@le7emesensmarrakech", hasWebsite: false, note: "Coiffure, esthétique, onglerie, hammam — IG uniquement" },

  // ==================== RESTAURANT / CAFÉ (7) ====================
  { name: "Carmel Marrakech", phone: "0669014161", sector: "Restaurant/Café", neighborhood: "Gueliz", instagram: "@cafecarmelmarrakech", hasWebsite: false, note: "Italien-Marocain près Majorelle — WhatsApp + IG only" },
  { name: "Café Guerrab", phone: "0524378330", sector: "Restaurant/Café", neighborhood: "Médina", instagram: "@cafe.guerrab", hasWebsite: false, note: "Café traditionnel Jemaa El Fna — pas de site" },
  { name: "Atay Cafe", phone: "0714169067", sector: "Restaurant/Café", neighborhood: "Médina", instagram: "@atay_cafe", hasWebsite: false, note: "Restaurant-café-rooftop — IG et tel uniquement" },
  { name: "La Ferme Medina", phone: "0705745410", sector: "Restaurant/Café", neighborhood: "Médina", instagram: "@la_fermemedina", hasWebsite: false, note: "35K followers IG! Riad-restaurant — pas de site web" },
  { name: "Zeitoun Gueliz Coffee", phone: "0524439560", sector: "Restaurant/Café", neighborhood: "Gueliz", instagram: "@zeitoungueliz", hasWebsite: false, note: "8.2K followers IG — pas de site" },

  // ==================== AVOCAT (8) ====================
  { name: "Maître Hicham Faiz", phone: "0662777197", sector: "Avocat", neighborhood: "Bab Doukkala", instagram: "", hasWebsite: false, note: "Av. 11 Janvier — aucune présence digitale" },
  { name: "Maître Touria El Barji", phone: "0666131339", sector: "Avocat", neighborhood: "Bab Doukkala", instagram: "", hasWebsite: false, note: "Pas de site ni réseaux sociaux" },
  { name: "Maître Reddad Chroqi", phone: "0662106161", sector: "Avocat", neighborhood: "Gueliz", instagram: "", hasWebsite: false, note: "10 Bd Allal El Fassi — annuaire uniquement" },
  { name: "Maître Bahija Doukrich", phone: "0670727053", sector: "Avocat", neighborhood: "Marrakech", instagram: "", hasWebsite: false, note: "Pas de site web" },
  { name: "Maître Nacer Serhane", phone: "0663829072", sector: "Avocat", neighborhood: "Marrakech", instagram: "", hasWebsite: false, note: "Annuaire uniquement" },
  { name: "Maître Latifa Moutamassik", phone: "0678559420", sector: "Avocat", neighborhood: "Marrakech", instagram: "", hasWebsite: false, note: "Pas de site web" },
  { name: "Maître Fouzia Charaf Eddine", phone: "0668417638", sector: "Avocat", neighborhood: "Marrakech", instagram: "", hasWebsite: false, note: "Pas de site web ni réseaux sociaux" },

  // ==================== PHOTOGRAPHE / VIDÉASTE (4) ====================
  { name: "Taouss Vision Photographe", phone: "0620502700", sector: "Photographe/Vidéaste", neighborhood: "Marrakech", instagram: "@taoussivision", hasWebsite: false, note: "19K followers IG! Mariages, familles — AUCUN site portfolio" },
  { name: "Photo Focus Art", phone: "0661708581", sector: "Photographe/Vidéaste", neighborhood: "Marrakech", instagram: "@photo.focus.art", hasWebsite: false, note: "22K followers! Maternité/famille/mariage — pas de site" },
  { name: "Marrakech Wedding Photography", phone: "0668274677", sector: "Photographe/Vidéaste", neighborhood: "Marrakech", instagram: "@marrakech_wedding_photography", hasWebsite: false, note: "Photographe + vidéaste mariage — IG uniquement" },

  // ==================== SPA / HAMMAM (7) ====================
  { name: "Hammam Targa", phone: "0611959739", sector: "Spa/Hammam", neighborhood: "Targa", instagram: "@hammamtarga", hasWebsite: false, note: "Réservations 100% téléphone, IG = seule présence en ligne" },
  { name: "Marrakech Spa Hammam & Massage", phone: "0707716161", sector: "Spa/Hammam", neighborhood: "Gueliz", instagram: "@marrakech.massage", hasWebsite: false, note: "Perd tout le trafic Google touristes — pas de site" },
  { name: "Hammam & Spa Elwiam", phone: "0602503196", sector: "Spa/Hammam", neighborhood: "Médina", instagram: "@hammam_spa_elwiam", hasWebsite: false, note: "Nouveau spa — pas encore de site web" },
  { name: "Hammam & Spa Khmissa", phone: "0696513975", sector: "Spa/Hammam", neighborhood: "Targa", instagram: "@hammam_spa_khmissa", hasWebsite: false, note: "Sur TripAdvisor mais pas de site propre" },
  { name: "Hammam Le Bain Bleu", phone: "0666929268", sector: "Spa/Hammam", neighborhood: "Médina", instagram: "@lebainbleu_marrakech", hasWebsite: false, note: "Populaire avec touristes — WhatsApp uniquement" },
  { name: "Hammam California", phone: "0524392265", sector: "Spa/Hammam", neighborhood: "Targa", instagram: "@hammamcalifornia", hasWebsite: true, note: "Site basique, pas mobile-friendly, pas de réservation en ligne" },
  { name: "Spa Marjana", phone: "0667909506", sector: "Spa/Hammam", neighborhood: "Hay Massira", instagram: "@spamarjana", hasWebsite: true, note: "Site spa-marjana.ma obsolète, français uniquement — besoin refonte" },

  // ==================== PÂTISSERIE / BOULANGERIE (6) ====================
  { name: "Boulangerie Pâtisserie Kawtar", phone: "0661391580", sector: "Patisserie", neighborhood: "Gueliz", instagram: "@bp_kawtar", hasWebsite: false, note: "Depuis 2017, IG + Facebook only — pas de site" },
  { name: "Pâtisserie Belkabir", phone: "0524421766", sector: "Patisserie", neighborhood: "Médina", instagram: "@patisserie.belkabir", hasWebsite: false, note: "4.7/5 TripAdvisor! Pas de site — perd les touristes" },
  { name: "Boulangerie Le Gueliz", phone: "0524431417", sector: "Patisserie", neighborhood: "Gueliz", instagram: "@le_gueliz_marrakech", hasWebsite: false, note: "Centre Gueliz — IG et téléphone uniquement" },
  { name: "Chocolatl Marrakech", phone: "0766485157", sector: "Patisserie", neighborhood: "Marrakech", instagram: "@chocolatl.kech", hasWebsite: false, note: "Chocolatier artisanal — IG et email only" },

  // ==================== AUTO-ÉCOLE (5) ====================
  { name: "Auto Ecole TAHA", phone: "0662637437", sector: "Auto-école", neighborhood: "Manar III", instagram: "", hasWebsite: false, note: "SARL depuis 2016 — zéro présence digitale" },
  { name: "Auto Ecole Al Massira", phone: "0661729768", sector: "Auto-école", neighborhood: "Massira", instagram: "", hasWebsite: false, note: "Quartier dense — pas de site, 100% bouche à oreille" },
  { name: "Auto Ecole Atlas", phone: "0524446770", sector: "Auto-école", neighborhood: "Gueliz", instagram: "", hasWebsite: false, note: "Bd Moulay Rachid — adresse premium, zéro web" },
  { name: "Auto Ecole Al Amane", phone: "0524397571", sector: "Auto-école", neighborhood: "Ménara", instagram: "", hasWebsite: false, note: "Aucun concurrent en ligne dans ce quartier" },

  // ==================== CRÈCHE / ÉCOLE MATERNELLE (5) ====================
  { name: "Crèche et Maternelle Cirine", phone: "0524290622", sector: "Crèche/École", neighborhood: "Daoudiate", instagram: "", hasWebsite: false, note: "Active depuis 2009 — pas de site, les parents cherchent en ligne" },
  { name: "Crèche Les 4 Saisons", phone: "0648446663", sector: "Crèche/École", neighborhood: "Gueliz", instagram: "@les_4_saisons_creche_marrakech", hasWebsite: true, note: "Site minimal crecheles4saisons.org — pas d'inscription en ligne" },
  { name: "Crèche Dar Al Amane", phone: "0699740235", sector: "Crèche/École", neighborhood: "Marrakech", instagram: "", hasWebsite: false, note: "Mobile uniquement — un site avec formulaire inscription = confiance" },
  { name: "Crèche Angel", phone: "0524349649", sector: "Crèche/École", neighborhood: "Marrakech", instagram: "", hasWebsite: false, note: "Aucune présence web — les jeunes parents cherchent sur Google" },
  { name: "Mino Mido Crèche", phone: "0524420511", sector: "Crèche/École", neighborhood: "Marrakech", instagram: "", hasWebsite: false, note: "Pas de site — aucun concurrent local en ligne non plus" },

  // ==================== WEDDING PLANNER / ÉVÉNEMENTIEL (4) ====================
  { name: "Maison Berrada Event Planner", phone: "0661454783", sector: "Wedding Planner", neighborhood: "Marrakech", instagram: "@maison_berrada_event_planner", hasWebsite: false, note: "29K followers IG!!! Pas de site — ÉNORME opportunité" },
  { name: "Salle Ramane", phone: "0662624366", sector: "Wedding Planner", neighborhood: "Marrakech", instagram: "@salle_ramane", hasWebsite: false, note: "38K followers! Salle de mariage — pas de site web" },
  { name: "Salle Rayan", phone: "0606486440", sector: "Wedding Planner", neighborhood: "Marrakech", instagram: "@salle_rayan", hasWebsite: false, note: "20K followers! — pas de site, réservations téléphone" },
  { name: "Mariage Wedding Marrakech", phone: "0666644227", sector: "Wedding Planner", neighborhood: "Marrakech", instagram: "@mariage_wedding_marrakech", hasWebsite: false, note: "4.7K followers, 2 numéros — pas de site" },

  // ==================== VÉTÉRINAIRE (4) ====================
  { name: "Cabinet Vétérinaire M'hamid", phone: "0524360826", sector: "Vétérinaire", neighborhood: "Mhamid", instagram: "", hasWebsite: false, note: "Seul véto du quartier — pas de site, annuaire uniquement" },
  { name: "Vétérinaire Loudaya", phone: "0524342120", sector: "Vétérinaire", neighborhood: "Hay Massira", instagram: "", hasWebsite: false, note: "Massira = grande zone résidentielle — aucun site véto" },
  { name: "ElHoutaia Sanâa Vétérinaire", phone: "0524436405", sector: "Vétérinaire", neighborhood: "Gueliz", instagram: "", hasWebsite: false, note: "Cabinet individuel avec horaires réguliers — pas de site" },
  { name: "Cabinet Vétérinaire Agafay", phone: "0666378408", sector: "Vétérinaire", neighborhood: "Gueliz", instagram: "@agafayvetpractice", hasWebsite: false, note: "Dr Loubna Aammar, IG active — ouverte au digital" },

  // ==================== COACH SPORTIF (2) ====================
  { name: "First Class Coaching", phone: "0680378001", sector: "Coach Sportif", neighborhood: "Gueliz", instagram: "@1st_class_coaching", hasWebsite: false, note: "Boxe-thérapie, remise en forme — IG only, pas de réservation en ligne" },
  { name: "Fitness Time Marrakech", phone: "0693474366", sector: "Salle de Sport", neighborhood: "Marrakech", instagram: "@fitness01time", hasWebsite: false, note: "Coach Soufiane Warak — IG + tel uniquement" },

  // ==================== FLEURISTE (3) ====================
  { name: "Fleuriste STOTI", phone: "0663152419", sector: "Fleuriste", neighborhood: "Gueliz", instagram: "@fleuriste_marrakech_officiel", hasWebsite: false, note: "21.6K followers IG! Art floral — pas de e-commerce ni commande en ligne" },
  { name: "Fleurs Marrakech", phone: "0649868146", sector: "Fleuriste", neighborhood: "Marrakech", instagram: "@fleurs.marrakech", hasWebsite: false, note: "Fleurs naturelles & séchées — IG only" },
  { name: "Bouquets et Fleurs", phone: "0660350169", sector: "Fleuriste", neighborhood: "Gueliz", instagram: "", hasWebsite: false, note: "Magasin 7 Rue des FAR — téléphone uniquement, zéro digital" },

  // ==================== OPTICIEN (3) ====================
  { name: "Laurence Optic", phone: "0524055493", sector: "Opticien", neighborhood: "Route Casa", instagram: "@laurence.optic", hasWebsite: false, note: "45K followers IG! Grandes marques — AUCUN site, zéro conversion funnel" },
  { name: "Hamza Optic", phone: "0634988677", sector: "Opticien", neighborhood: "Gueliz", instagram: "@opticien_marrakech", hasWebsite: true, note: "Site WordPress basique, pas de e-commerce ni catalogue produits" },
  { name: "Soleya Optique", phone: "0660252300", sector: "Opticien", neighborhood: "Marrakech", instagram: "", hasWebsite: false, note: "Tel + WhatsApp uniquement — pas de site ni IG" },

  // ==================== PARAPHARMACIE (3) ====================
  { name: "Parapharmacie Targa", phone: "0667014427", sector: "Parapharmacie", neighborhood: "Targa", instagram: "@parapharmacietarga", hasWebsite: false, note: "9.2K followers IG! Commandes WhatsApp only — pas de e-commerce" },
  { name: "Parapharmacie Centrale Gueliz", phone: "0666878558", sector: "Parapharmacie", neighborhood: "Gueliz", instagram: "@parapharmacie_centrale_gueliz", hasWebsite: false, note: "166 Bd Mohamed V — IG + tel, pas de boutique en ligne" },
  { name: "Parapharmacie Aéroport", phone: "0617990990", sector: "Parapharmacie", neighborhood: "Zone Aéroport", instagram: "@parapharmacie_aeroport", hasWebsite: false, note: "Livraison Maroc entier mais pas de site — WhatsApp orders" },

  // ==================== BOUTIQUE MODE (2) ====================
  { name: "NIS MODE", phone: "0655639818", sector: "Boutique Mode", neighborhood: "Marrakech", instagram: "@nis_mode", hasWebsite: false, note: "28K followers! Prêt-à-porter — vend uniquement via IG DMs" },
  { name: "POUR ELLE", phone: "0617436550", sector: "Boutique Mode", neighborhood: "Marrakech", instagram: "@pourellemodechic", hasWebsite: false, note: "4.5K followers, livraison Maroc — pas de site e-commerce" },

  // ==================== CABINET COMPTABLE (3) ====================
  { name: "Elmoumen Conseil", phone: "0524303013", sector: "Cabinet Comptable", neighborhood: "Gueliz", instagram: "", hasWebsite: false, note: "Depuis 2012, email Gmail — pas de site web professionnel" },
  { name: "Thalal Consultants", phone: "0524432898", sector: "Cabinet Comptable", neighborhood: "Gueliz", instagram: "", hasWebsite: false, note: "23 Rue Tarik Bnou Ziad — téléphone + fax uniquement" },
  { name: "Lkasmi & Co Expertise", phone: "0661716208", sector: "Cabinet Comptable", neighborhood: "Marrakech", instagram: "", hasWebsite: false, note: "Expert-comptable certifié — zéro empreinte digitale" },
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
        priority: p.hasWebsite ? 3 : (p.instagram ? 1 : 2), status: "A_ENVOYER",
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
  console.log(`\nBatch 8 seeded ${created} new prospects.`);
  console.log(`Total: ${total} | With phone: ${withPhone} | À envoyer: ${pending}`);
}

main().then(() => prisma.$disconnect());
