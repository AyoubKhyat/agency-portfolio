import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const prospects = [
  // HIGH VALUE: Traiteurs with phones - they handle weddings/events = big budgets
  { name: "Traiteur Samira Aitlhaj", phone: "0618572446", sector: "Traiteur", neighborhood: "Boumasmae", instagram: "@traiteursamiraaitlhaj", note: "Commandes 48h, ouvert 7j/7" },
  { name: "Le Jarret Marrakech", phone: "0691919117", sector: "Traiteur", neighborhood: "", instagram: "@lejarret", note: "Boucherie + volaille + traiteur" },
  { name: "Les Maitres Prestiges", phone: "0668474798", sector: "Traiteur", neighborhood: "", instagram: "@lesmaitresprestiges", note: "Traiteur luxe mariages, 20+ ans expérience" },
  { name: "Les Délices de Marrakech", phone: "0629198140", sector: "Traiteur", neighborhood: "", instagram: "@les_delices_de_mvrrakech", note: "B2B/B2C, livraison + service" },
  { name: "Traiteur Ouriki Marrakech", phone: "", sector: "Traiteur", neighborhood: "", instagram: "@traiteur_ouriki_marrakech", note: "" },

  // HIGH VALUE: Pâtisseries with phones + delivery = need e-commerce
  { name: "Elomari Cakes", phone: "", sector: "Patisserie", neighborhood: "", instagram: "@elomari_cakes", note: "3.3K followers - gâteaux personnalisés + royal icing" },
  { name: "Pâtisserie des Princes", phone: "", sector: "Patisserie", neighborhood: "", instagram: "@patisseriedesprinces", note: "Institution Marrakech" },
  { name: "Gaza Marrakech", phone: "0655554131", sector: "Patisserie", neighborhood: "", instagram: "", note: "SITE EN CONSTRUCTION! Perfect lead - needs a site NOW" },

  // HIGH VALUE: Commerce/retail with phones + big followings
  { name: "Pacifish Marrakech", phone: "0663333538", sector: "Restaurant/Café", neighborhood: "", instagram: "@pacifish.official", note: "8.4K followers - poissonnier, WhatsApp commandes" },
  { name: "Patchi Morocco", phone: "0668112356", sector: "Patisserie", neighborhood: "", instagram: "@patchi.ma", note: "43K followers! Chocolatier premium" },
  { name: "Marrakech Ventes", phone: "0606060533", sector: "Boutique Mode", neighborhood: "", instagram: "@marrakechventes", note: "16K followers - ventes en ligne" },

  // Groupe L'Adresse - multi-location restaurant group
  { name: "Groupe L'Adresse", phone: "", sector: "Restaurant/Café", neighborhood: "Gueliz + Jemaa", instagram: "@groupeladresse", note: "Café + restaurant + patisserie, 3 locations" },

  // Traiteur marocain sur commande
  { name: "Traiteur Marocain Sur Commande", phone: "", sector: "Traiteur", neighborhood: "", instagram: "@traiteur_marocain_sur_commande", note: "Mariages, food marocain" },

  // Pâtisserie with website under construction
  { name: "Pâtisserie Gato", phone: "", sector: "Patisserie", neighborhood: "", instagram: "", hasWebsite: true, note: "A un site patisseriegato.ma mais peut améliorer" },

  // More salons with potential
  { name: "Salon Luis Kraemer", phone: "", sector: "Salon Beauté", neighborhood: "", instagram: "", note: "Salon haut de gamme Marrakech" },
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
        instagram: p.instagram || "", hasWebsite: (p as any).hasWebsite || false,
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
  console.log(`\nSeeded ${created} new. Total: ${total} | With phone: ${withPhone} | À envoyer: ${pending}`);
}

main().then(() => prisma.$disconnect());
