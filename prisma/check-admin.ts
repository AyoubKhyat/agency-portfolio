import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.adminUser.findMany();
  console.log(`Admin users: ${users.length}`);
  users.forEach(u => console.log(`  - ${u.email}`));
}

main().then(() => prisma.$disconnect());
