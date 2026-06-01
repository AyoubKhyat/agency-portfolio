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

  return NextResponse.json({ results, seeded: results.length });
}
