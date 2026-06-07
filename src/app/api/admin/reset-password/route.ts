import { NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { logAudit, getClientIp } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  userId: z.string().min(1, "userId is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * POST /api/admin/reset-password
 *
 * Admin-only endpoint to reset any team member's password.
 * Updates both the AdminUser and User tables.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (!hasPrisma()) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { userId, newPassword } = parsed.data;

  try {
    // Look up the User row to get their email (needed to find AdminUser)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newHash = await hashPassword(newPassword);

    // Update User table
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Update AdminUser table (if they have one)
    const adminRow = await prisma.adminUser.findUnique({
      where: { email: user.email },
    });
    if (adminRow) {
      await prisma.adminUser.update({
        where: { email: user.email },
        data: { passwordHash: newHash },
      });
    }

    // Audit log
    await logAudit({
      userId: session.userId,
      userName: session.fullName,
      action: "RESET_PASSWORD",
      entity: "user",
      entityId: userId,
      details: { targetEmail: user.email, targetName: user.fullName },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, message: `Password reset for ${user.fullName}` });
  } catch (e) {
    console.error("[reset-password] error:", e);
    return NextResponse.json(
      { error: "Failed to reset password", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
