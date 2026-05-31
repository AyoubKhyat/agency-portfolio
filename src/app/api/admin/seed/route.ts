import { NextResponse } from "next/server";
import { prisma, hasPrisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const TEAM = [
  { name: "Ayoub Khyat", email: "ayoubkhyat@gmail.com", password: "AyoubKhyat2026", role: "admin", initials: "AK" },
  { name: "Mohammed Yousfi", email: "mohammed.yousfi@ibda3digital.com", password: "MohammedYousfi2026", role: "admin", initials: "MY" },
  { name: "Ismail Sarhir", email: "ismail.sarhir@ibda3digital.com", password: "IsmailSarhir2026", role: "admin", initials: "IS" },
  { name: "Soufiane El Kaabaoui", email: "soufiane.elkaabaoui@ibda3digital.com", password: "SoufianeElKaabaoui2026", role: "admin", initials: "SE" },
  { name: "Abderrahmane Ait Taleb", email: "abderrahmane.aittaleb@ibda3digital.com", password: "AbderrahmaneAitTaleb2026", role: "admin", initials: "AA" },
];

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== "ibda3seed2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!hasPrisma()) {
    return NextResponse.json({ error: "No database" }, { status: 503 });
  }

  const results: string[] = [];

  for (const m of TEAM) {
    const hash = await bcrypt.hash(m.password, 12);

    await prisma.adminUser.upsert({
      where: { email: m.email },
      update: { passwordHash: hash, name: m.name },
      create: { email: m.email, passwordHash: hash, name: m.name },
    });
    results.push(`AdminUser: ${m.email}`);

    try {
      await prisma.user.upsert({
        where: { email: m.email },
        update: { passwordHash: hash, fullName: m.name, role: m.role, avatarInitials: m.initials },
        create: { email: m.email, passwordHash: hash, fullName: m.name, role: m.role, avatarInitials: m.initials },
      });
      results.push(`User: ${m.email}`);
    } catch (e) {
      results.push(`User error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Force all users to admin role
  try {
    await prisma.$executeRawUnsafe(`UPDATE users SET role = 'admin'`);
    results.push("All users set to admin role");
  } catch (e) {
    results.push(`Role update error: ${e instanceof Error ? e.message : String(e)}`);
  }

  const adminCount = await prisma.adminUser.count();
  let userCount = 0;
  try { userCount = await prisma.user.count(); } catch { /* ignore */ }

  return NextResponse.json({ results, adminCount, userCount });
}
