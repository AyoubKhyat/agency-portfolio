import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const all = await prisma.prospect.findMany();
  let fixed = 0;
  for (const p of all) {
    const digits = p.phone.replace(/\D/g, "");
    const isLandline = /^0?5\d{8}$/.test(digits) || /^2125\d{8}$/.test(digits);
    if (isLandline && !p.instagram && p.status === "A_ENVOYER") {
      await prisma.prospect.update({
        where: { id: p.id },
        data: { status: "PAS_DE_WHATSAPP" },
      });
      console.log(`${p.name} (${p.phone}) → PAS_DE_WHATSAPP (landline, no IG)`);
      fixed++;
    } else if (isLandline && p.instagram) {
      console.log(`${p.name} (${p.phone}) — landline but has IG @${p.instagram}, will use Instagram DM`);
    }
  }
  console.log(`\nFixed ${fixed} landline-only prospects.`);
}

main().then(() => prisma.$disconnect());
