import { NextResponse } from "next/server";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET() {
  const info: Record<string, unknown> = {
    hasPrisma: hasPrisma(),
    userModelType: typeof (prisma as Record<string, unknown>).user,
    adminUserModelType: typeof (prisma as Record<string, unknown>).adminUser,
  };

  if (hasPrisma()) {
    try {
      const userCount = await prisma.user.count();
      info.userCount = userCount;
    } catch (e) {
      info.userError = e instanceof Error ? e.message : String(e);
    }

    try {
      const adminCount = await prisma.adminUser.count();
      info.adminCount = adminCount;
    } catch (e) {
      info.adminError = e instanceof Error ? e.message : String(e);
    }

    try {
      const ayoub = await prisma.user.findUnique({ where: { email: "ayoubkhyat@gmail.com" } });
      info.ayoubFound = !!ayoub;
      info.ayoubId = ayoub?.id;
    } catch (e) {
      info.ayoubError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(info);
}
