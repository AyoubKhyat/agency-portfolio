import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const prospects = [
  // Restaurants/Cafés with WhatsApp
  { name: "Manzil Marrakech Lounge", phone: "0673732084", sector: "Restaurant/Café", neighborhood: "Marrakech", instagram: "@manzil.marrakech", note: "Lounge + restaurant + hookah, WhatsApp reservations" },
  { name: "Taj Medina Marrakech", phone: "0661610909", sector: "Restaurant/Café", neighborhood: "Medina", instagram: "", note: "Restaurant + café, terrasse vue medina" },
  { name: "Café Arabe", phone: "0666935913", sector: "Restaurant/Café", neighborhood: "Medina", instagram: "@cafearabemarrakech", note: "Près Jemaa El Fna. Aussi: 0653068080" },

  // Salons with phones (from directories)
  { name: "Niya Beauty", phone: "", sector: "Salon Beauté", neighborhood: "Gueliz", instagram: "", note: "75 rue de Paris" },
  { name: "Salon D'Europe Coiffure", phone: "", sector: "Salon Beauté", neighborhood: "", instagram: "", note: "" },
  { name: "Institut 7ème Sens", phone: "", sector: "Salon Beauté", neighborhood: "Gueliz", instagram: "", note: "Coiffure + esthétique + nail art + hammam" },

  // Parapharmacie with phones
  { name: "Parapharmacie Gran Via", phone: "", sector: "Pharmacie/Parapharmacie", neighborhood: "Izdihar", instagram: "@pharmacie_para.centraleizdihar", note: "" },

  // More restaurants from Google
  { name: "Kechmara", phone: "0524422532", sector: "Restaurant/Café", neighborhood: "Gueliz", instagram: "", note: "Restaurant + bar + galerie, institution Gueliz" },
  { name: "Nomad Marrakech", phone: "0524381609", sector: "Restaurant/Café", neighborhood: "Medina", instagram: "", note: "Rooftop, terrasse Rahba Lakdima" },
  { name: "La Famille", phone: "0524385295", sector: "Restaurant/Café", neighborhood: "Medina", instagram: "", note: "Végétarien, cour intérieure" },

  // Boutiques mode with phones
  { name: "Marwa Stores", phone: "", sector: "Boutique Mode", neighborhood: "", instagram: "@marwastores", note: "135K followers - mode femme" },

  // Hammam with phones from search
  { name: "Hanane Center Hammam", phone: "0661104217", sector: "Spa/Hammam", neighborhood: "", instagram: "@hananecenter", note: "Massage + hammam + spa" },
  { name: "Hammam Massage Marrakech", phone: "", sector: "Spa/Hammam", neighborhood: "Gueliz", instagram: "@massage_hammam_marrakech", note: "Hammam + massage + coiffure" },

  // Bijouterie with phone
  { name: "Bijouterie Marrakech", phone: "", sector: "Bijouterie", neighborhood: "", instagram: "@bijouteriemarrakech_", note: "" },
  { name: "O Finity Bijoux", phone: "", sector: "Bijouterie", neighborhood: "", instagram: "@o_finity_ma", note: "" },

  // Auto-école
  { name: "Auto École Chawki", phone: "", sector: "Auto-école", neighborhood: "", instagram: "@auto_ecole_chawki", note: "" },
  { name: "Auto École Dsouli", phone: "", sector: "Auto-école", neighborhood: "", instagram: "@auto_ecole_dsouli", note: "" },

  // Décoration
  { name: "Maison Bencherif", phone: "", sector: "Décoration/Meubles", neighborhood: "", instagram: "@maison_bencherif_marrakech", note: "" },

  // Transport
  { name: "Services Transport Touristique", phone: "", sector: "Transport Touristique", neighborhood: "", instagram: "@services_transport_touristique", note: "" },
  { name: "Transport Touristique Kech", phone: "", sector: "Transport Touristique", neighborhood: "", instagram: "@transport_touristiques_kech", note: "" },
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
        instagram: p.instagram, hasWebsite: false,
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
  console.log(`\nSeeded ${created} new prospects. Total: ${total} (${withPhone} with phone)`);
}

main().then(() => prisma.$disconnect());
