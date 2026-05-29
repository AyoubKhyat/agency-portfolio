import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const adapter = new PrismaNeon(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.adminUser.findMany();
  console.log(`Admin users: ${users.length}`);
  users.forEach(u => console.log(`  - ${u.email} | hash: ${u.passwordHash.substring(0, 20)}...`));

  if (users.length > 0) {
    const match = await bcrypt.compare("admin123", users[0].passwordHash);
    console.log(`\nPassword "admin123" matches: ${match}`);
  }
}

main().then(() => prisma.$disconnect());
