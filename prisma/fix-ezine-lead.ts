import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const p = await prisma.prospect.findFirst({
    where: { name: { contains: "EZINE" } },
    include: { notes: true },
  });
  if (!p) { console.log("Not found"); return; }

  const lead = await prisma.lead.create({
    data: {
      fullName: p.name,
      email: "n/a",
      phone: p.phone || undefined,
      subject: `[Prospecting] ${p.sector}`,
      message: `Converted from prospecting.\nSector: ${p.sector}\nPhone: ${p.phone}\nNeighborhood: ${p.neighborhood || "—"}`,
      status: "NEW",
    },
  });
  console.log(`Created lead: ${lead.id} — ${lead.fullName}`);
}

main().then(() => prisma.$disconnect());
