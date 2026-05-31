import { NextResponse } from "next/server";
import { prisma, hasPrisma } from "@/lib/prisma";
import { verifyPassword, signToken, createSessionCookie } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  if (!hasPrisma()) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  try {
    // Try User table first (team accounts)
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.isActive && await verifyPassword(password, user.passwordHash)) {
      const token = await signToken({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarInitials: user.avatarInitials,
      });
      const cookie = createSessionCookie(token);
      const res = NextResponse.json({ success: true, name: user.fullName, role: user.role });
      res.cookies.set(cookie);
      return res;
    }

    // Fallback to AdminUser table (legacy)
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (admin && await verifyPassword(password, admin.passwordHash)) {
      const token = await signToken({
        userId: admin.id,
        email: admin.email,
        fullName: admin.name,
        role: "admin",
        avatarInitials: admin.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2),
      });
      const cookie = createSessionCookie(token);
      const res = NextResponse.json({ success: true, name: admin.name, role: "admin" });
      res.cookies.set(cookie);
      return res;
    }

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  } catch (e) {
    console.error("[login] error:", e);
    return NextResponse.json({ error: "Login error", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
