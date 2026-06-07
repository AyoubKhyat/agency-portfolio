import { NextResponse } from "next/server";
import { prisma, hasPrisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const TEAM = [
  { name: "Ayoub Khyat", email: "ayoubkhyat@gmail.com", role: "admin", initials: "AK" },
  { name: "Mohammed Yousfi", email: "mohammed.yousfi@ibda3digital.com", role: "sales", initials: "MY" },
  { name: "Ismail Sarhir", email: "ismail.sarhir@ibda3digital.com", role: "sales", initials: "IS" },
  { name: "Soufiane El Kaabaoui", email: "soufiane.elkaabaoui@ibda3digital.com", role: "sales", initials: "SE" },
  { name: "Abderrahmane Ait Taleb", email: "abderrahmane.aittaleb@ibda3digital.com", role: "sales", initials: "AA" },
];

const CHANNELS = [
  { slug: "general", name: "General", description: "Discussion générale de l'équipe" },
  { slug: "projects", name: "Projets", description: "Suivi et coordination des projets" },
  { slug: "sales", name: "Ventes", description: "Pipeline commercial et prospection" },
];

export async function POST(req: Request) {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const password = body.password;
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Provide a password in request body" }, { status: 400 });
  }

  const results: string[] = [];

  for (const m of TEAM) {
    const hash = await bcrypt.hash(password, 12);

    await prisma.adminUser.upsert({
      where: { email: m.email },
      update: { passwordHash: hash, name: m.name },
      create: { email: m.email, passwordHash: hash, name: m.name },
    });

    try {
      await prisma.user.upsert({
        where: { email: m.email },
        update: { passwordHash: hash, fullName: m.name, role: m.role, avatarInitials: m.initials },
        create: { email: m.email, passwordHash: hash, fullName: m.name, role: m.role, avatarInitials: m.initials },
      });
      results.push(`${m.name} (${m.role})`);
    } catch (e) {
      results.push(`Error: ${m.name} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Seed default chat channels with all team members
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const channelResults: string[] = [];

  for (const ch of CHANNELS) {
    const existing = await prisma.channel.findUnique({ where: { slug: ch.slug } });
    if (existing) {
      channelResults.push(`#${ch.slug} (exists)`);
      continue;
    }

    await prisma.channel.create({
      data: {
        slug: ch.slug,
        name: ch.name,
        description: ch.description,
        isDm: false,
        members: {
          create: allUsers.map((u) => ({ userId: u.id })),
        },
      },
    });
    channelResults.push(`#${ch.slug} (created, ${allUsers.length} members)`);
  }

  return NextResponse.json({ results, channels: channelResults, seeded: results.length });
}
