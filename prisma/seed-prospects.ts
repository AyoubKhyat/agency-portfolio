import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const prospects = [
  // === NEW LEADS (25) ===
  // Salons Beauté
  { name: "Christian Gilles Marrakech", phone: "", sector: "Salon Beauté", neighborhood: "Gueliz", instagram: "@christiangilles_marrakech", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "40 ans expertise - 16K followers" },
  { name: "Les Soeurs Parisiennes", phone: "", sector: "Salon Beauté", neighborhood: "Blvd Mohamed V", instagram: "@lessoeursparisiennes", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "Institut haut de gamme - 28K followers" },
  { name: "Salon Jawad Aek", phone: "", sector: "Salon Beauté", neighborhood: "", instagram: "@aek_coif_j_", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "Lissage + soins - 13K followers" },
  { name: "Marroccia Beauty", phone: "", sector: "Salon Beauté", neighborhood: "Gueliz Plaza", instagram: "@marrocciasalonbeauty", hasWebsite: true, priority: 3, status: "A_ENVOYER", note: "16K followers - marrocciabeautysalon.com" },
  // Salles de Sport
  { name: "Palace des Sports", phone: "", sector: "Salle de Sport", neighborhood: "", instagram: "@palace_des_sports", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "#1 Fitness Maroc - piscine + CrossFit" },
  { name: "MyCross Gym", phone: "", sector: "Salle de Sport", neighborhood: "Targa", instagram: "@mycross_gym", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "CrossTraining 7j/7" },
  { name: "FitLab", phone: "", sector: "Salle de Sport", neighborhood: "Av Hassan II", instagram: "@fitlabmarrakech", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "Lun-Sam 7h-23h" },
  { name: "O2 Fitness", phone: "0524304812", sector: "Salle de Sport", neighborhood: "", instagram: "@o2fitness.ma", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "Tel aussi: 0700706706" },
  { name: "Fitness Al Boughaz", phone: "", sector: "Salle de Sport", neighborhood: "Mhamid", instagram: "@fitness.alboughaz", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "" },
  // Riads
  { name: "Riad El Arco", phone: "", sector: "Riad/Maison d'hôtes", neighborhood: "Medina", instagram: "@riadelarco_marrakech", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "WhatsApp booking - pas de site" },
  { name: "Riad Rafaele & SPA", phone: "0663471774", sector: "Riad/Maison d'hôtes", neighborhood: "Medina", instagram: "@riadrafaele", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "WhatsApp FR: +33 663471774" },
  { name: "Riad BE Marrakech", phone: "0670364105", sector: "Riad/Maison d'hôtes", neighborhood: "Medina", instagram: "@bemarrakech", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "Rooftop + restaurant - réservation only" },
  { name: "Riad Dar More", phone: "", sector: "Riad/Maison d'hôtes", neighborhood: "Medina", instagram: "@riaddarmore", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "" },
  { name: "Riad Christina", phone: "0524384384", sector: "Riad/Maison d'hôtes", neighborhood: "Centre Medina", instagram: "@riadchristina", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "Centre Medina" },
  // Photographes
  { name: "Taoussivision", phone: "0620502700", sector: "Photographe/Vidéaste", neighborhood: "", instagram: "@taoussivision", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "19K followers - mariage + events" },
  { name: "Photo Focus Art", phone: "", sector: "Photographe/Vidéaste", neighborhood: "", instagram: "@photo.focus.art", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "22K followers - maternité famille mariage" },
  { name: "Shooting Marrakech", phone: "", sector: "Photographe/Vidéaste", neighborhood: "", instagram: "@shootingmarrakech", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "2.3K followers - couples EVJF" },
  { name: "Astronaut.e", phone: "", sector: "Photographe/Vidéaste", neighborhood: "", instagram: "@astronaut.e", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "3.4K followers - photo + vidéo" },
  // Immobilier
  { name: "MLuxury Marrakech", phone: "", sector: "Immobilier", neighborhood: "Gueliz", instagram: "@mluxurymarrakech", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "Immobilier luxe" },
  { name: "Le 25 Immobilier", phone: "", sector: "Immobilier", neighborhood: "Gueliz", instagram: "@le25immo", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "Residence Eros" },
  { name: "Caprice Immobilier", phone: "", sector: "Immobilier", neighborhood: "", instagram: "@capriceimmobilier", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "809 followers" },
  { name: "Agence Immobilier Marrakech I", phone: "", sector: "Immobilier", neighborhood: "", instagram: "@agenceimmobiliermarrakechi", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "" },
  // Boulangerie/Pâtisserie
  { name: "Le Gueliz Boulangerie", phone: "", sector: "Boulangerie", neighborhood: "Quartier Mabrouka Gueliz", instagram: "@le_gueliz_marrakech", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "" },
  { name: "Boulangerie Marrakech", phone: "", sector: "Boulangerie", neighborhood: "", instagram: "@boulangerie_marrakech", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "" },
  { name: "L'Atelier Boulangerie", phone: "", sector: "Boulangerie", neighborhood: "", instagram: "@boulangerielatelier.marrakech", hasWebsite: false, priority: 1, status: "A_ENVOYER", note: "Restaurant + traiteur aussi" },

  // === EXISTING LEADS FROM GOOGLE SHEET (54) ===
  // Dentistes
  { name: "Dr Hind Nadim", phone: "0606239619", sector: "Dentiste", neighborhood: "Daoudiate", instagram: "@drhindnadim", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "70K followers" },
  { name: "Dr H. Dassouli", phone: "0642647958", sector: "Dentiste", neighborhood: "Mhamid", instagram: "@cabinet_dr_dassouli", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "12K followers" },
  { name: "Dr El Fadli Imane", phone: "0620022087", sector: "Dentiste", neighborhood: "", instagram: "@dentiste.marrakech", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Centre Dentaire Samsah", phone: "0708057363", sector: "Dentiste", neighborhood: "", instagram: "@dentiste.marrakech.samsah", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "Urgences 24/7" },
  { name: "Dr Houda Samoudi", phone: "0524292168", sector: "Dentiste", neighborhood: "", instagram: "@cabinetdentairedrhoudasamoudi", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Dr Oussama Nahi", phone: "0544097148", sector: "Dentiste", neighborhood: "Massira", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Karim Hassan Montana", phone: "0524438630", sector: "Dentiste", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Landline only" },
  { name: "Elidrissi Nabil Habti", phone: "0524431952", sector: "Dentiste", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Landline only" },
  { name: "Ahmed Elmouedden", phone: "0524302038", sector: "Dentiste", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Landline only" },
  { name: "Rached Chebbo", phone: "0524300036", sector: "Dentiste", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Landline only" },
  { name: "Toubi Asmaa", phone: "0524312662", sector: "Dentiste", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Landline only" },
  { name: "Elhoussaini Amine Elghazi", phone: "0524311311", sector: "Dentiste", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Landline only" },
  { name: "Rachida Kachani", phone: "0524346558", sector: "Dentiste", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Landline only" },
  { name: "Ahmed Faiz", phone: "0524447690", sector: "Dentiste", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Landline only" },
  { name: "Abdellatif Chraibi", phone: "0524433414", sector: "Dentiste", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Landline only" },
  { name: "Moncef Jouay", phone: "0524492822", sector: "Dentiste", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Landline only" },
  { name: "Amina Hamimaz", phone: "0524439072", sector: "Dentiste", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Landline only" },
  { name: "Hanane Boumert", phone: "0524361872", sector: "Dentiste", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Landline only" },
  { name: "Mustapha Haddid", phone: "0524405294", sector: "Dentiste", neighborhood: "SYBA", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Landline only" },
  // Avocats
  { name: "Me. Abdemounim Mikir / Nizar", phone: "0666448698", sector: "Avocat", neighborhood: "Bab Doukkala", instagram: "", hasWebsite: false, priority: 2, status: "REPONDU", sentAt: "2026-05-09", note: "Veut avis Google - DUPLIQUÉ" },
  { name: "Me. Nacer Serhane", phone: "0663829072", sector: "Avocat", neighborhood: "Gueliz", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Av Zerktouni" },
  { name: "Me. Fouzia Charaf Eddine", phone: "0668417638", sector: "Avocat", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  // Salons Beauté (existing)
  { name: "En Secret Marrakech", phone: "0666686692", sector: "Salon Beauté", neighborhood: "", instagram: "@ensecretmarrakech", hasWebsite: false, priority: 1, status: "PAS_DE_WHATSAPP", sentAt: null, note: "" },
  { name: "BBC Marrakech", phone: "0611576774", sector: "Salon Beauté", neighborhood: "", instagram: "@bbc.marrakech", hasWebsite: false, priority: 1, status: "PAS_DE_WHATSAPP", sentAt: null, note: "" },
  { name: "Salon Mouna Marrakech", phone: "0661301966", sector: "Salon Beauté", neighborhood: "Gueliz", instagram: "@salonmounamarrakech", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "20+ ans experience" },
  { name: "100% Femme (Eclat de Beaute)", phone: "0661244675", sector: "Salon Beauté", neighborhood: "Al Izdihar", instagram: "@salon_eclat_de_beaute", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Cazance", phone: "0664114546", sector: "Salon Beauté", neighborhood: "", instagram: "@cazance", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "29K followers" },
  { name: "Hafid Tendance Coiffure", phone: "0666528408", sector: "Salon Beauté", neighborhood: "Gueliz", instagram: "@tendance.coiffure.officielle", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Studio 83", phone: "0662608376", sector: "Salon Beauté", neighborhood: "Gueliz", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Nails epilation cils" },
  { name: "IZZALIA (Maison de Beaute)", phone: "0673108081", sector: "Salon Beauté", neighborhood: "Gueliz", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  // Sport
  { name: "Fun Fitness Marrakech", phone: "0663388388", sector: "Salle de Sport", neighborhood: "Sidi Abbad", instagram: "@funfitnessmarrakech", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "7K followers" },
  { name: "Marrakech Sports Center", phone: "0662204186", sector: "Salle de Sport", neighborhood: "Route Essaouira", instagram: "@marrakechsportscenter", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  // Architectes
  { name: "Concept Archidesign", phone: "0637683748", sector: "Architecte/Décorateur", neighborhood: "", instagram: "@concept_archi_design", hasWebsite: true, priority: 3, status: "ENVOYE", sentAt: "2026-05-09", note: "21K followers" },
  { name: "Studio KA", phone: "0661624492", sector: "Architecte/Décorateur", neighborhood: "Sidi Ghanem", instagram: "@studioka.architecture", hasWebsite: true, priority: 3, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "BD Creation", phone: "0661980038", sector: "Architecte/Décorateur", neighborhood: "Sidi Ghanem", instagram: "", hasWebsite: true, priority: 3, status: "ENVOYE", sentAt: "2026-05-09", note: "15+ ans" },
  // Immobilier
  { name: "Agence Immo El Idrissi", phone: "0638913174", sector: "Immobilier", neighborhood: "Allal El Fassi", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Agence Immo El Badii", phone: "0633002500", sector: "Immobilier", neighborhood: "Berrima", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Agence Immo El Fath", phone: "0662202426", sector: "Immobilier", neighborhood: "Hay Massira", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Carpat-Immo", phone: "0678960184", sector: "Immobilier", neighborhood: "Medina", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "Fondee 2007" },
  { name: "Menara House Agency", phone: "0661553002", sector: "Immobilier", neighborhood: "Menara", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "EZINE SURGAR", phone: "0700727165", sector: "Immobilier", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Moojooda", phone: "0652662494", sector: "Immobilier", neighborhood: "", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Global IMMO Marrakech", phone: "0618271686", sector: "Immobilier", neighborhood: "Route de Safi", instagram: "@yasglobalimmo", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Marrakech Real Homes", phone: "0616811379", sector: "Immobilier", neighborhood: "La Menara", instagram: "", hasWebsite: false, priority: 2, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "My Marrakech Immobilier", phone: "0666096909", sector: "Immobilier", neighborhood: "", instagram: "@mymarrakech.immobilier", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  // Restaurant/Café
  { name: "Le Pavillon JIT", phone: "0670742209", sector: "Restaurant/Café", neighborhood: "Sidi Ghanem", instagram: "@lepavillonjit", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "La Cantina", phone: "0665136996", sector: "Restaurant/Café", neighborhood: "Sidi Ghanem", instagram: "@lacantine.ma", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "Italien" },
  { name: "Terra Mia Cafe", phone: "0662355025", sector: "Restaurant/Café", neighborhood: "Gueliz", instagram: "@terramiacafe", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "LK Patisserie", phone: "0648380834", sector: "Patisserie", neighborhood: "", instagram: "@lk_patisserie_", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "BP Kawtar", phone: "0661391580", sector: "Boulangerie", neighborhood: "", instagram: "@bp_kawtar", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Chez Corleone", phone: "0648521473", sector: "Restaurant/Café", neighborhood: "Hay Charaf", instagram: "@chez.corleone", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Baguetto Massira", phone: "0641790163", sector: "Restaurant/Café", neighborhood: "Massira", instagram: "@baguetto_massira", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "AL FADL Patisserie", phone: "0674900405", sector: "Patisserie", neighborhood: "", instagram: "@patisserie_alfadl", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Le 6 Marrakech", phone: "0613604352", sector: "Restaurant/Café", neighborhood: "Hivernage", instagram: "@le6marrakech", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "" },
  { name: "Maison Sama Traiteur", phone: "0661694847", sector: "Traiteur", neighborhood: "", instagram: "@maisonsama.traiteur", hasWebsite: false, priority: 1, status: "ENVOYE", sentAt: "2026-05-09", note: "Mariages evenements" },
];

async function main() {
  let created = 0;
  for (const p of prospects) {
    const phone = p.phone.replace(/^0/, "212");
    const whatsappLink = phone ? `https://wa.me/${phone}` : "";

    const prospect = await prisma.prospect.create({
      data: {
        name: p.name,
        phone: p.phone,
        whatsappLink,
        sector: p.sector,
        neighborhood: p.neighborhood,
        instagram: p.instagram,
        hasWebsite: p.hasWebsite,
        priority: p.priority,
        status: p.status,
        sentAt: (p as any).sentAt ? new Date((p as any).sentAt) : null,
      },
    });

    if (p.note) {
      await prisma.prospectNote.create({
        data: { prospectId: prospect.id, content: p.note },
      });
    }
    created++;
  }

  console.log(`Seeded ${created} prospects.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
