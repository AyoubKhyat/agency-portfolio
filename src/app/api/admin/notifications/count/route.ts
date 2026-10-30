import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  const { session } = auth;
  if (!hasPrisma()) return NextResponse.json({ unread: 0 });

  const unread = await prisma.notification.count({
    where: { userId: session.userId, read: false },
  });
  return NextResponse.json({ unread });
}
