import { NextResponse } from "next/server";
import { prisma, hasPrisma } from "@/lib/prisma";
import { verifyPassword, signToken, createSessionCookie } from "@/lib/auth";
import { neon } from "@neondatabase/serverless";
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
    // Query users table directly via Neon HTTP SQL
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      const sql = neon(dbUrl);
      const users = await sql`SELECT id, email, full_name, password_hash, role, avatar_initials, is_active FROM users WHERE email = ${email} LIMIT 1`;

      if (users.length > 0) {
        const user = users[0];
        if (user.is_active && await verifyPassword(password, user.password_hash)) {
          const token = await signToken({
            userId: user.id,
            email: user.email,
            fullName: user.full_name,
            role: user.role,
            avatarInitials: user.avatar_initials,
          });
          const cookie = createSessionCookie(token);
          const res = NextResponse.json({ success: true, name: user.full_name, role: user.role });
          res.cookies.set(cookie);
          return res;
        }
      }
    }

    // Fallback to AdminUser via Prisma
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
