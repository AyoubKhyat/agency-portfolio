import { NextResponse } from "next/server";
import { prisma, hasPrisma } from "@/lib/prisma";
import { verifyPassword, signToken, createSessionCookie } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ROLE_MAP: Record<string, string> = {
  "ayoubkhyat@gmail.com": "admin",
  "mohammed.yousfi@ibda3digital.com": "sales",
  "ismail.sarhir@ibda3digital.com": "sales",
  "soufiane.elkaabaoui@ibda3digital.com": "sales",
  "abderrahmane.aittaleb@ibda3digital.com": "developer",
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

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
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const role = ROLE_MAP[email] ?? "sales";
    const token = await signToken({
      userId: admin.id,
      email: admin.email,
      fullName: admin.name,
      role,
      avatarInitials: getInitials(admin.name),
    });
    const cookie = createSessionCookie(token);

    const res = NextResponse.json({ success: true, name: admin.name, role });
    res.cookies.set(cookie);
    return res;
  } catch (e) {
    console.error("[login] error:", e);
    return NextResponse.json({ error: "Login error", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
