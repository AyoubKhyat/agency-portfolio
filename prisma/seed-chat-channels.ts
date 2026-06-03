import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import dotenv from "dotenv";

dotenv.config();

const DEFAULTS = [
  { slug: "general",     name: "General",     description: "Agency-wide chat" },
  { slug: "prospecting", name: "Prospecting", description: "Outreach, replies, follow-ups" },
  { slug: "sales",       name: "Sales",       description: "Proposals, negotiations, deals" },
  { slug: "projects",    name: "Projects",    description: "Delivery and project chatter" },
  { slug: "support",     name: "Support",     description: "Client questions and tickets" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  try {
    const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, fullName: true } });
    console.log(`Found ${users.length} active users to add as channel members.`);

    for (const ch of DEFAULTS) {
      const existing = await prisma.channel.findUnique({ where: { slug: ch.slug } });
      const channel = existing ?? await prisma.channel.create({
        data: { slug: ch.slug, name: ch.name, description: ch.description, isDm: false },
      });
      console.log(`${existing ? "Found" : "Created"} channel: ${channel.name}`);

      // Make sure every active user is a member.
      for (const u of users) {
        await prisma.channelMember.upsert({
          where: { channelId_userId: { channelId: channel.id, userId: u.id } },
          create: { channelId: channel.id, userId: u.id },
          update: {},
        });
      }
    }

    console.log("\nDone. Channels:");
    const all = await prisma.channel.findMany({ include: { _count: { select: { members: true, messages: true } } } });
    console.table(all.map((c) => ({ slug: c.slug, name: c.name, isDm: c.isDm, members: c._count.members, messages: c._count.messages })));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
