import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Fix Riad Rafaele — French number
  const rafaele = await prisma.prospect.findFirst({ where: { name: "Riad Rafaele & SPA" } });
  if (rafaele) {
    await prisma.prospect.update({
      where: { id: rafaele.id },
      data: { phone: "+33663471774", whatsappLink: "https://wa.me/33663471774" },
    });
    console.log("Fixed Riad Rafaele phone → +33663471774");
  }

  // Mark Riad BE Marrakech as REPONDU
  const riadBE = await prisma.prospect.findFirst({ where: { name: "Riad BE Marrakech" } });
  if (riadBE) {
    await prisma.prospect.update({
      where: { id: riadBE.id },
      data: { status: "REPONDU" },
    });
    console.log("Riad BE Marrakech → REPONDU");
  }
}

main().then(() => prisma.$disconnect());
