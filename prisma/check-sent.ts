import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const sent = await prisma.prospect.findMany({ where: { status: "ENVOYE" }, orderBy: { updatedAt: "desc" } });
  const replied = await prisma.prospect.findMany({ where: { status: "REPONDU" } });
  const converted = await prisma.prospect.findMany({ where: { status: "CONVERTI" } });
  const noWa = await prisma.prospect.findMany({ where: { status: "PAS_DE_WHATSAPP" } });
  const pending = await prisma.prospect.count({ where: { status: "A_ENVOYER" } });

  console.log(`=== SENT (${sent.length}) ===`);
  sent.forEach(p => console.log(`  ${p.name} — ${p.sector} — ${p.sentAt ? new Date(p.sentAt).toLocaleDateString("fr-FR") : "no date"}`));
  console.log(`\n=== REPLIED (${replied.length}) ===`);
  replied.forEach(p => console.log(`  ${p.name} — ${p.sector}`));
  console.log(`\n=== CONVERTED (${converted.length}) ===`);
  converted.forEach(p => console.log(`  ${p.name} — ${p.sector}`));
  console.log(`\n=== PAS DE WHATSAPP (${noWa.length}) ===`);
  noWa.forEach(p => console.log(`  ${p.name}`));
  console.log(`\n=== PENDING: ${pending} ===`);
}

main().then(() => prisma.$disconnect());
