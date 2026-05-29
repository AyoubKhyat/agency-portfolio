import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const updates: { name: string; phone: string }[] = [
  { name: "Les Soeurs Parisiennes", phone: "0637293434" },
  { name: "Christian Gilles Marrakech", phone: "0660444591" },
  { name: "FitLab", phone: "0669090300" },
  { name: "Photo Focus Art", phone: "0661708581" },
  { name: "Riad El Arco", phone: "0808639443" },
];

async function main() {
  for (const u of updates) {
    const p = await prisma.prospect.findFirst({ where: { name: u.name } });
    if (p) {
      const phone = u.phone.replace(/\D/g, "");
      const whatsapp = `https://wa.me/212${phone.startsWith("0") ? phone.slice(1) : phone}`;
      await prisma.prospect.update({
        where: { id: p.id },
        data: { phone: u.phone, whatsappLink: whatsapp },
      });
      console.log(`${u.name} → ${u.phone}`);
    } else {
      console.log(`NOT FOUND: ${u.name}`);
    }
  }
}

main().then(() => prisma.$disconnect());
