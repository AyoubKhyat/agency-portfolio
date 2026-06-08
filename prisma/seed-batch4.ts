import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const prospects = [
  // Parapharmacie
  { name: "Parapharmacie Centrale Gueliz", phone: "0666878558", sector: "Pharmacie/Parapharmacie", neighborhood: "Gueliz", instagram: "@parapharmacie_centrale_gueliz", note: "166 BD Mohamed V" },
  { name: "La Grande Para de Marrakech", phone: "", sector: "Pharmacie/Parapharmacie", neighborhood: "", instagram: "@la.grandepara.de.marrakech", note: "1ère parapharmacie de Marrakech" },
  { name: "Parapharmacie Targa", phone: "", sector: "Pharmacie/Parapharmacie", neighborhood: "Targa", instagram: "@parapharmacietarga", note: "" },
  { name: "Para 339 Marrakech", phone: "", sector: "Pharmacie/Parapharmacie", neighborhood: "", instagram: "@parapharmaci_339", note: "" },
  { name: "Parapharmacie Abir", phone: "0637222905", sector: "Pharmacie/Parapharmacie", neighborhood: "Azli", instagram: "@abir.para", note: "Quartier Azli Sud" },

  // Bijouterie
  { name: "Rafinity Marrakech", phone: "", sector: "Bijouterie", neighborhood: "", instagram: "@rafinity.marrakech", note: "46K followers - or 18 carats" },
  { name: "MADD Bijoutier Joaillier", phone: "", sector: "Bijouterie", neighborhood: "Gueliz", instagram: "@madd.bijoutier.joaillier", note: "4 générations, 6 rue des Vieux Marrakechis" },
  { name: "Bijouterie Elyakout", phone: "", sector: "Bijouterie", neighborhood: "", instagram: "@bijouterie.elyakout", note: "Or 18K" },
  { name: "Yasmina Bijouterie", phone: "", sector: "Bijouterie", neighborhood: "Medina", instagram: "@yasmina.bijouterie", note: "Souk, argent + pierres fines" },

  // Comptable
  { name: "Fincosa Marrakech", phone: "", sector: "Cabinet Comptable", neighborhood: "", instagram: "@fincosamarrakech", note: "1.6K followers - comptabilité + audit" },
  { name: "Comptable Marrakech", phone: "", sector: "Cabinet Comptable", neighborhood: "", instagram: "@comptablemarrakech", note: "Création entreprise + compta" },

  // Transport touristique
  { name: "TransKech", phone: "0710072241", sector: "Transport Touristique", neighborhood: "", instagram: "@marrakesh_transport_agency_", note: "1K followers, transfers + tours" },
  { name: "Voyages21 Maroc", phone: "0524331007", sector: "Transport Touristique", neighborhood: "", instagram: "@voyages21maroc", note: "14K followers" },
  { name: "Chauffeur Privé Marrakech", phone: "", sector: "Transport Touristique", neighborhood: "", instagram: "@chauffeur_prive_marrakech", note: "" },
  { name: "Almou Tourism", phone: "0524358854", sector: "Transport Touristique", neighborhood: "", instagram: "@almou__tourism", note: "" },

  // Imprimerie
  { name: "Imprimerie El Watanya", phone: "", sector: "Imprimerie", neighborhood: "", instagram: "@imprimerie.elwatanya", note: "Design + packaging + impression" },
  { name: "Event Print Marrakech", phone: "", sector: "Imprimerie", neighborhood: "", instagram: "@eventprint.ma", note: "" },
  { name: "UPRINT Marrakech", phone: "0524423186", sector: "Imprimerie", neighborhood: "", instagram: "@uprintmaroc", note: "" },
  { name: "360 Printing Solutions", phone: "", sector: "Imprimerie", neighborhood: "", instagram: "@360print.ma", note: "Digital + packaging + signalétique" },

  // Artisan (plombier/électricien)
  { name: "Électricien Marrakech", phone: "0661523488", sector: "Artisan/Services", neighborhood: "", instagram: "@electricien.marrakech", note: "Plomberie + électricité, urgences 24/7" },
  { name: "Plombier El Bakouri", phone: "", sector: "Artisan/Services", neighborhood: "", instagram: "@plombierelbakouri", note: "" },
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
        priority: 1, status: "A_ENVOYER",
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
