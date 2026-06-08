import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const statuses = ["A_ENVOYER", "ENVOYE", "REPONDU", "PAS_DE_WHATSAPP", "CONVERTI"];
  for (const s of statuses) {
    const count = await prisma.prospect.count({ where: { status: s } });
    console.log(`${s}: ${count}`);
  }
  const total = await prisma.prospect.count();
  console.log(`TOTAL: ${total}`);
}

main().then(() => prisma.$disconnect());
