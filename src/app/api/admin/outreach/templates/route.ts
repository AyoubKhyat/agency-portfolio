import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ templates: [] });

  const templates = await prisma.outreachTemplate.findMany({
    where: { isActive: true },
    select: { key: true, name: true, channel: true, language: true, body: true, subject: true },
    orderBy: { key: "asc" },
  });

  return NextResponse.json({ templates });
}
