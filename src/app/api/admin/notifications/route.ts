import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json([]);

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const type = searchParams.get("type") || undefined;
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

  const where: Record<string, unknown> = { userId: session.userId };
  if (unreadOnly) where.read = false;
  if (type) where.type = type;

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(notifications);
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ success: true });

  const body = await req.json();

  if (body.markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: session.userId, read: false },
      data: { read: true },
    });
    return NextResponse.json({ success: true });
  }

  if (body.id) {
    const notif = await prisma.notification.findUnique({ where: { id: body.id } });
    if (!notif || notif.userId !== session.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.notification.update({
      where: { id: body.id },
      data: { read: body.read === false ? false : true },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid" }, { status: 400 });
}
