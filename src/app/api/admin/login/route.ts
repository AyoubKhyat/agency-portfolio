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
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

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
  } catch (e) {
    console.error("[login] DB error:", e);
    return NextResponse.json({ error: "Database error", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
