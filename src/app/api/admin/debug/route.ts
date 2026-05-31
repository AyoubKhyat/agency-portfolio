import { NextResponse } from "next/server";
import { prisma, hasPrisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const testEmail = url.searchParams.get("email") || "ayoubkhyat@gmail.com";

  const dbUrl = process.env.DATABASE_URL || "";
  const info: Record<string, unknown> = { hasPrisma: hasPrisma(), dbHost: dbUrl.split("@")[1]?.split("/")[0] ?? "unknown" };

  if (hasPrisma()) {
    try {
      info.userCount = await prisma.user.count();
      const user = await prisma.user.findUnique({ where: { email: testEmail } });
      info.userFound = !!user;
      if (user) {
        info.userId = user.id;
        info.hashPrefix = user.passwordHash.substring(0, 10);
        info.isActive = user.isActive;
        const testPw = url.searchParams.get("pw");
        if (testPw) {
          info.passwordMatch = await verifyPassword(testPw, user.passwordHash);
        }
      }
    } catch (e) {
      info.userError = e instanceof Error ? e.message : String(e);
    }

    try {
      info.adminCount = await prisma.adminUser.count();
    } catch (e) {
      info.adminError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(info);
}
