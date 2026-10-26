import { NextResponse } from "next/server";
import { getSession, signToken, createSessionCookie } from "@/lib/auth";
import { isOwner, checkLoginPassword, setLoginPassword, updateTeamUser, MIN_PASSWORD_LENGTH } from "@/lib/account-security";
import { logAudit, getClientIp } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  role: z.enum(["admin", "sales", "designer", "developer"]).optional(),
  avatarInitials: z.string().min(1).max(3).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`).optional(),
  currentPassword: z.string().min(1).optional(),
});

/**
 * PATCH /api/admin/users/[id]
 * Anyone signed in may edit their own name and initials, and change their own password with their
 * current password. Everything else (other people's accounts, any email, role or active-flag
 * change) is owner-only. Password changes update the real login password and end the user's
 * other sessions; changing your own password keeps you signed in on this device.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { password, currentPassword, ...changes } = parsed.data;

  const self = id === session.userId;
  const sensitive = !self || changes.email !== undefined || changes.role !== undefined || changes.isActive !== undefined;
  const owner = await isOwner(session);
  if (sensitive && !owner) {
    return NextResponse.json({ error: "Only the account owner can do this" }, { status: 403 });
  }
  if (self && changes.isActive === false) {
    return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
  }

  try {
    let newSelfHash: string | null = null;
    if (password !== undefined) {
      if (self && !(currentPassword && (await checkLoginPassword(session.email, currentPassword)))) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
      }
      const hash = await setLoginPassword(id, password);
      if (!hash) {
        return NextResponse.json({ error: "This user has no login account" }, { status: 404 });
      }
      if (self) newSelfHash = hash;
      await logAudit({
        userId: session.userId,
        userName: session.fullName,
        action: self ? "CHANGE_PASSWORD" : "RESET_PASSWORD",
        entity: "user",
        entityId: id,
        ipAddress: getClientIp(req),
      });
    }

    let user = null;
    if (Object.keys(changes).length > 0) {
      user = await updateTeamUser(id, changes);
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      if (sensitive) {
        await logAudit({
          userId: session.userId,
          userName: session.fullName,
          action: "UPDATE_USER",
          entity: "user",
          entityId: id,
          details: { fields: Object.keys(changes) },
          ipAddress: getClientIp(req),
        });
      }
    }

    const res = NextResponse.json(user ?? { success: true });
    if (newSelfHash) {
      // The new password ended every session of this user, including this one: issue a fresh cookie.
      res.cookies.set(createSessionCookie(await signToken(session, newSelfHash)));
    }
    return res;
  } catch (e) {
    console.error("[users] update failed:", e instanceof Error ? e.name : "error");
    return NextResponse.json({ error: "Update failed (is that email already in use?)" }, { status: 409 });
  }
}
