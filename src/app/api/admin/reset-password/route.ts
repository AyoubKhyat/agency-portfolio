import { NextResponse } from "next/server";
import { getSession, signToken, createSessionCookie } from "@/lib/auth";
import { isOwner, setLoginPassword, MIN_PASSWORD_LENGTH } from "@/lib/account-security";
import { hasPrisma } from "@/lib/prisma";
import { logAudit, getClientIp } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  userId: z.string().min(1, "userId is required"),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
});

/**
 * POST /api/admin/reset-password
 *
 * Owner-only: set any team member's login password (admin_users, with users kept in step).
 * The new password ends that user's existing sessions.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isOwner(session))) {
    return NextResponse.json({ error: "Only the account owner can reset passwords" }, { status: 403 });
  }
  if (!hasPrisma()) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { userId, newPassword } = parsed.data;

  try {
    const hash = await setLoginPassword(userId, newPassword);
    if (!hash) {
      return NextResponse.json({ error: "User not found or has no login account" }, { status: 404 });
    }

    await logAudit({
      userId: session.userId,
      userName: session.fullName,
      action: "RESET_PASSWORD",
      entity: "user",
      entityId: userId,
      ipAddress: getClientIp(req),
    });

    const res = NextResponse.json({ success: true });
    if (userId === session.userId) {
      // Resetting your own password ended this session too: keep the owner signed in here.
      res.cookies.set(createSessionCookie(await signToken(session, hash)));
    }
    return res;
  } catch (e) {
    console.error("[reset-password] error:", e instanceof Error ? e.name : "error");
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
