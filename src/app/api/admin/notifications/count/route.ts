import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ unread: 0 });

  const unread = await prisma.notification.count({
    where: { userId: session.userId, read: false },
  });
  return NextResponse.json({ unread });
}
