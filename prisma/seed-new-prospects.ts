import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const prospects = [
  // Auto-écoles
  { name: "Le Grand Pas Auto École", phone: "0658232032", sector: "Auto-école", neighborhood: "", instagram: "@legrandpas___", hasWebsite: false, priority: 1, note: "" },
  { name: "Auto-École La Jeunesse", phone: "0661484958", sector: "Auto-école", neighborhood: "Tasseltant", instagram: "@auto_ecole_la_jeunesse", hasWebsite: false, priority: 1, note: "Also: 0524385465" },
  { name: "Auto École Team Bennani", phone: "", sector: "Auto-école", neighborhood: "", instagram: "@autoecoleteambennani", hasWebsite: false, priority: 1, note: "" },
  { name: "Auto École Al Fourat", phone: "", sector: "Auto-école", neighborhood: "", instagram: "@autoecolealfourat", hasWebsite: false, priority: 1, note: "" },

  // Crèches / Écoles privées
  { name: "Étoiles Montantes", phone: "", sector: "Crèche/École", neighborhood: "", instagram: "@etoilesmontantesmarrakech", hasWebsite: false, priority: 1, note: "3 mois - 3 ans, cours anglais" },
  { name: "Petit Caillou", phone: "", sector: "Crèche/École", neighborhood: "", instagram: "@petitcaillou_marrakech", hasWebsite: false, priority: 1, note: "36K followers" },
  { name: "Mon Univers By Montessori", phone: "", sector: "Crèche/École", neighborhood: "", instagram: "@monuniverscreche", hasWebsite: false, priority: 1, note: "3 mois - 6 ans, orthophoniste" },
  { name: "Les Alisiers Crèche", phone: "", sector: "Crèche/École", neighborhood: "", instagram: "@les_alisiers_creche_marrakech", hasWebsite: false, priority: 1, note: "" },
  { name: "Les 4 Saisons Crèche", phone: "", sector: "Crèche/École", neighborhood: "", instagram: "@les_4_saisons_creche_marrakech", hasWebsite: false, priority: 1, note: "À partir de 3 mois" },
  { name: "Institution Targa", phone: "", sector: "Crèche/École", neighborhood: "Targa", instagram: "@institution.targa.marrakech", hasWebsite: false, priority: 1, note: "Crèche → Lycée" },

  // Wedding Planners
  { name: "Maroc Sensations", phone: "", sector: "Wedding Planner", neighborhood: "", instagram: "@marocsensations", hasWebsite: false, priority: 1, note: "11K followers" },
  { name: "La Perle Events", phone: "", sector: "Wedding Planner", neighborhood: "", instagram: "@laperlevents_marrakech", hasWebsite: false, priority: 1, note: "7.4K followers" },
  { name: "Morocco Go Events", phone: "", sector: "Wedding Planner", neighborhood: "", instagram: "@moroccogoevents", hasWebsite: false, priority: 1, note: "Planning, design, catering" },
  { name: "Salle Ramane", phone: "", sector: "Wedding Planner", neighborhood: "", instagram: "@salle_ramane", hasWebsite: false, priority: 1, note: "Salle de fête + traiteur" },
  { name: "Diâa Lahmamsi Wedding", phone: "", sector: "Wedding Planner", neighborhood: "", instagram: "@wedding_planner_diaa_lahmamsi", hasWebsite: false, priority: 1, note: "Événements haut de gamme" },

  // Vétérinaires
  { name: "Clinique Vétérinaire Ines", phone: "", sector: "Vétérinaire", neighborhood: "", instagram: "@clinique_veterinaire_ines", hasWebsite: false, priority: 1, note: "24h/24, chirurgie" },
  { name: "Clinique Vétérinaire Yasmine", phone: "", sector: "Vétérinaire", neighborhood: "", instagram: "@mon_veterinaire", hasWebsite: false, priority: 1, note: "" },
  { name: "Cabinet Vétérinaire Agafay", phone: "", sector: "Vétérinaire", neighborhood: "Gueliz", instagram: "@agafayvetpractice", hasWebsite: false, priority: 1, note: "Dr. Loubna, Blvd Abdelkrim Al Khattabi" },
  { name: "Clinique Vétérinaire Zerktouni", phone: "", sector: "Vétérinaire", neighborhood: "", instagram: "@cliniquevet_zerktouni", hasWebsite: false, priority: 1, note: "205 Blvd La Résistance" },

  // Opticiens
  { name: "Laurence Optic", phone: "0524055493", sector: "Opticien", neighborhood: "", instagram: "@laurence.optic", hasWebsite: false, priority: 1, note: "45K followers - grandes marques" },
  { name: "Hamza Optic", phone: "", sector: "Opticien", neighborhood: "", instagram: "@opticien_marrakech", hasWebsite: false, priority: 1, note: "3K followers, livraison Maroc" },
  { name: "My Glasses Marrakech", phone: "", sector: "Opticien", neighborhood: "Allal El Fassi", instagram: "@opticienmyglassesmarrakech", hasWebsite: false, priority: 1, note: "Centre Malizia" },

  // Fleuristes
  { name: "Fleuriste Marrakech STOTI", phone: "", sector: "Fleuriste", neighborhood: "", instagram: "@fleuriste_marrakech_officiel", hasWebsite: false, priority: 1, note: "Livraison gratuite à domicile" },
  { name: "Fleurs Marrakech", phone: "", sector: "Fleuriste", neighborhood: "", instagram: "@fleurs.marrakech", hasWebsite: false, priority: 1, note: "Vases en gros + fleurs" },
];

async function main() {
  let created = 0;
  for (const p of prospects) {
    const existing = await prisma.prospect.findFirst({ where: { name: p.name } });
    if (existing) { console.log(`SKIP: ${p.name} (already exists)`); continue; }

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
  console.log(`\nSeeded ${created} new prospects.`);
  const total = await prisma.prospect.count();
  console.log(`Total prospects in DB: ${total}`);
}

main().then(() => prisma.$disconnect());
