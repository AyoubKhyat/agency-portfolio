import { NextResponse } from "next/server";
import { prisma, hasPrisma } from "@/lib/prisma";
import { verifyPassword, signToken, createSessionCookie } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";
import { z } from "zod";
import { loginLimiter } from "@/lib/rate-limit";
import { withApiLogging } from "@/lib/api-logger";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ROLE_MAP: Record<string, string> = {
  "ayoubkhyat@gmail.com": "admin",
  "mohammed.yousfi@ibda3digital.com": "admin",
  "ismail.sarhir@ibda3digital.com": "admin",
  "soufiane.elkaabaoui@ibda3digital.com": "admin",
  "abderrahmane.aittaleb@ibda3digital.com": "admin",
};

async function loginHandler(req: Request) {
  // Rate limiting: max 5 login attempts per minute per IP
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const rateResult = loginLimiter.check(ip);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateResult.resetMs / 1000)) },
      },
    );
  }

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

    // ProspectActivity / Task / ChannelMember / Notification all FK to User.id.
    // We refuse to issue a session that doesn't map to a real, active User row
    // because any subsequent activity write would crash with a FK violation
    // (prospect_activities_user_id_fkey). Admins who only exist in adminUser
    // need a User row before they can log in.
    const teamUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, fullName: true, avatarInitials: true, role: true, isActive: true },
    });
    if (!teamUser) {
      return NextResponse.json(
        { error: "This account isn't linked to a team member record. Ask an admin to provision a User row before logging in." },
        { status: 403 },
      );
    }
    if (!teamUser.isActive) {
      return NextResponse.json({ error: "Your account is inactive." }, { status: 403 });
    }

    const role = ROLE_MAP[email] ?? teamUser.role ?? "sales";
    const token = await signToken({
      userId: teamUser.id,
      email: admin.email,
      fullName: teamUser.fullName,
      role,
      avatarInitials: teamUser.avatarInitials,
    });
    const cookie = createSessionCookie(token);

    // Audit: successful login
    await logAudit({
      userId: teamUser.id,
      userName: teamUser.fullName,
      action: "LOGIN",
      details: { email, role },
      ipAddress: getClientIp(req),
    });

    const res = NextResponse.json({ success: true, name: admin.name, role });
    res.cookies.set(cookie);
    return res;
  } catch (e) {
    console.error("[login] error:", e);
    return NextResponse.json({ error: "Login error", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/login", loginHandler);
