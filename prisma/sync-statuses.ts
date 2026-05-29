import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const updates: { name: string; status: string; sentAt?: string }[] = [
  // Sent via WhatsApp tonight
  { name: "Riad BE Marrakech", status: "REPONDU", sentAt: "2026-05-29" },
  { name: "Riad Christina", status: "ENVOYE", sentAt: "2026-05-29" },
  { name: "Taoussivision", status: "ENVOYE", sentAt: "2026-05-29" },
  // Sent via Instagram DM tonight
  { name: "L'Atelier Boulangerie", status: "ENVOYE", sentAt: "2026-05-29" },
  { name: "Boulangerie Marrakech", status: "ENVOYE", sentAt: "2026-05-29" },
  { name: "Le Gueliz Boulangerie", status: "ENVOYE", sentAt: "2026-05-29" },
  { name: "Les Soeurs Parisiennes", status: "ENVOYE", sentAt: "2026-05-29" },
  { name: "Fitness Al Boughaz", status: "ENVOYE", sentAt: "2026-05-29" },
  { name: "Riad Dar More", status: "ENVOYE", sentAt: "2026-05-29" },
  { name: "Shooting Marrakech", status: "ENVOYE", sentAt: "2026-05-29" },
  { name: "Astronaut.e", status: "ENVOYE", sentAt: "2026-05-29" },
  { name: "MLuxury Marrakech", status: "ENVOYE", sentAt: "2026-05-29" },
  { name: "Le 25 Immobilier", status: "ENVOYE", sentAt: "2026-05-29" },
  { name: "Caprice Immobilier", status: "PAS_DE_WHATSAPP" },
  { name: "Christian Gilles Marrakech", status: "ENVOYE", sentAt: "2026-05-29" },
  // Converted to lead
  { name: "EZINE SURGAR", status: "CONVERTI" },
  // Replied from original batch
  { name: "Me. Abdemounim Mikir / Nizar", status: "REPONDU" },
  // Riad Rafaele - fixed phone
  { name: "Riad Rafaele & SPA", status: "A_ENVOYER" },
];

async function main() {
  let updated = 0;
  for (const u of updates) {
    const p = await prisma.prospect.findFirst({ where: { name: u.name } });
    if (!p) { console.log(`NOT FOUND: ${u.name}`); continue; }

    const data: Record<string, unknown> = { status: u.status };
    if (u.sentAt) data.sentAt = new Date(u.sentAt);

    await prisma.prospect.update({ where: { id: p.id }, data });
    console.log(`${u.name} → ${u.status}`);
    updated++;
  }

  // Also update phone numbers
  const phoneUpdates = [
    { name: "Les Soeurs Parisiennes", phone: "0637293434" },
    { name: "Christian Gilles Marrakech", phone: "0660444591" },
    { name: "FitLab", phone: "0669090300" },
    { name: "Photo Focus Art", phone: "0661708581" },
    { name: "Riad Rafaele & SPA", phone: "+33663471774" },
  ];
  for (const u of phoneUpdates) {
    const p = await prisma.prospect.findFirst({ where: { name: u.name } });
    if (!p) continue;
    const phone = u.phone.replace(/^0/, "212");
    const whatsappLink = u.phone.startsWith("+33")
      ? `https://wa.me/${u.phone.replace(/\D/g, "")}`
      : `https://wa.me/${phone}`;
    await prisma.prospect.update({ where: { id: p.id }, data: { phone: u.phone, whatsappLink } });
    console.log(`${u.name} phone → ${u.phone}`);
  }

  // Create the EZINE SURGAR lead if not exists
  const existingLead = await prisma.lead.findFirst({ where: { fullName: "EZINE SURGAR" } });
  if (!existingLead) {
    await prisma.lead.create({
      data: {
        fullName: "EZINE SURGAR",
        email: "n/a",
        phone: "0700727165",
        subject: "[Prospecting] Immobilier",
        message: "Converted from prospecting.\nSector: Immobilier\nPhone: 0700727165",
        status: "NEW",
      },
    });
    console.log("Created EZINE SURGAR lead");
  }

  console.log(`\nUpdated ${updated} prospects.`);
}

main().then(() => prisma.$disconnect());
