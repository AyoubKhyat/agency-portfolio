import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUsers } from "@/lib/dal";
import { isOwner, createTeamUser, MIN_PASSWORD_LENGTH } from "@/lib/account-security";
import { logAudit, getClientIp } from "@/lib/audit";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await getUsers();
  return NextResponse.json(users);
}

const createSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  role: z.enum(["admin", "sales", "designer", "developer"]),
  avatarInitials: z.string().min(1).max(3),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isOwner(session))) {
    return NextResponse.json({ error: "Only the account owner can add team members" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const user = await createTeamUser(parsed.data);
  if (!user) {
    return NextResponse.json({ error: "That email is already used by another account" }, { status: 409 });
  }
  await logAudit({
    userId: session.userId,
    userName: session.fullName,
    action: "CREATE_USER",
    entity: "user",
    entityId: user.id,
    details: { role: user.role },
    ipAddress: getClientIp(req),
  });
  return NextResponse.json(user, { status: 201 });
}
