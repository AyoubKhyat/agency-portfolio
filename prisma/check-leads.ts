import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const leads = await prisma.lead.findMany();
  console.log(`Leads in DB: ${leads.length}`);
  leads.forEach(l => console.log(`  - ${l.fullName} | ${l.status} | ${l.subject}`));

  const converti = await prisma.prospect.findMany({ where: { status: "CONVERTI" } });
  console.log(`\nConverted prospects: ${converti.length}`);
  converti.forEach(p => console.log(`  - ${p.name}`));
}

main().then(() => prisma.$disconnect());
