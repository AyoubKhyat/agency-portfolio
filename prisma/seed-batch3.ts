import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const prospects = [
  // Coach Sportif
  { name: "Coach Miha Bodytec Marrakech", phone: "", sector: "Coach Sportif", neighborhood: "", instagram: "@marrakechcoachsportif", hasWebsite: false, priority: 1, note: "" },
  { name: "Youssef Sahmoum (Personal Trainer)", phone: "", sector: "Coach Sportif", neighborhood: "", instagram: "@youssef_sahmoum", hasWebsite: false, priority: 1, note: "Personal trainer" },
  { name: "Icham Coaching", phone: "", sector: "Coach Sportif", neighborhood: "", instagram: "@icham_coachofficiel", hasWebsite: false, priority: 1, note: "" },
  { name: "Body Agency Marrakech", phone: "", sector: "Coach Sportif", neighborhood: "", instagram: "@bodyagency_marrakech", hasWebsite: false, priority: 1, note: "" },

  // Spa / Hammam
  { name: "Marrakech Spa Hammam & Massage", phone: "0707716161", sector: "Spa/Hammam", neighborhood: "", instagram: "@marrakech.massage", hasWebsite: false, priority: 1, note: "2K followers, WhatsApp dispo" },
  { name: "Alphaïs Spa Marrakech", phone: "", sector: "Spa/Hammam", neighborhood: "Medina", instagram: "@alphaisspamarrakech", hasWebsite: false, priority: 1, note: "Hammam + jacuzzi + massage" },
  { name: "Mawli Spa", phone: "", sector: "Spa/Hammam", neighborhood: "Gueliz", instagram: "@mawlispa", hasWebsite: false, priority: 1, note: "Opera Business Centre" },
  { name: "L'Orienthaï Spa", phone: "", sector: "Spa/Hammam", neighborhood: "", instagram: "@lorienthaispa", hasWebsite: false, priority: 1, note: "Hammam + massages + head spa" },
  { name: "House Spa Marrakech", phone: "", sector: "Spa/Hammam", neighborhood: "Gueliz", instagram: "@hou.sespa", hasWebsite: false, priority: 1, note: "Hammam + coiffure + beauté" },
  { name: "Hammam Le Bain Bleu", phone: "0666929268", sector: "Spa/Hammam", neighborhood: "Medina", instagram: "@lebainbleu_marrakech", hasWebsite: false, priority: 1, note: "Hammam traditionnel + massage" },
  { name: "Kesh Hammam Spa", phone: "", sector: "Spa/Hammam", neighborhood: "", instagram: "@kesh.hammamspa", hasWebsite: false, priority: 1, note: "" },

  // Centres de formation
  { name: "English & Business Corner", phone: "", sector: "Centre de Formation", neighborhood: "", instagram: "@ebc.marrakech", hasWebsite: false, priority: 1, note: "Cours anglais toddlers → adultes" },
  { name: "Atlantique Centre Marrakech", phone: "", sector: "Centre de Formation", neighborhood: "", instagram: "@atlantique_centre_marrakech", hasWebsite: false, priority: 1, note: "Langues + formation pro" },
  { name: "British Academy School", phone: "", sector: "Centre de Formation", neighborhood: "", instagram: "@britishacademyschmar", hasWebsite: false, priority: 1, note: "British education" },

  // Garage Auto
  { name: "RPM Garage Marrakech", phone: "", sector: "Garage Auto", neighborhood: "", instagram: "@rpmgarage.marrakech", hasWebsite: false, priority: 1, note: "5.8K followers - mécanique + carrosserie" },

  // Décoration / Meubles
  { name: "Soft Life Déco", phone: "", sector: "Décoration/Meubles", neighborhood: "Sidi Ghanem", instagram: "@soft_lifedeco", hasWebsite: false, priority: 1, note: "Meubles luxe sur mesure" },
  { name: "Sketch Marrakech", phone: "", sector: "Décoration/Meubles", neighborhood: "Sidi Ghanem", instagram: "@sketch.marrakech", hasWebsite: false, priority: 1, note: "Plus grand showroom meubles à Marrakech" },

  // Boutiques Mode
  { name: "NIS MODE", phone: "", sector: "Boutique Mode", neighborhood: "", instagram: "@nis_mode", hasWebsite: false, priority: 1, note: "28K followers - prêt à porter" },
  { name: "House Blouse", phone: "", sector: "Boutique Mode", neighborhood: "", instagram: "@houseblouse.ma", hasWebsite: false, priority: 1, note: "Vêtements travail sur mesure + uniformes médicaux" },
  { name: "L'Atelier du Sport Marrakech", phone: "", sector: "Boutique Mode", neighborhood: "", instagram: "@latelierdusport.marrakech", hasWebsite: false, priority: 1, note: "Streetwear homme/femme" },
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
        sector: p.sector, neighborhood: p.neighborhood,
        instagram: p.instagram, hasWebsite: p.hasWebsite,
        priority: p.priority, status: "A_ENVOYER",
      },
    });

    if (p.note) {
      await prisma.prospectNote.create({ data: { prospectId: prospect.id, content: p.note } });
    }
    created++;
  }
  const total = await prisma.prospect.count();
  console.log(`\nSeeded ${created} new prospects. Total: ${total}`);
}

main().then(() => prisma.$disconnect());
