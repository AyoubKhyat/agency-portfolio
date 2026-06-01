import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ duplicates: [] });

  const url = new URL(req.url);
  const name = url.searchParams.get("name") || "";
  const phone = url.searchParams.get("phone") || "";
  const instagram = url.searchParams.get("instagram") || "";
  const excludeId = url.searchParams.get("excludeId") || undefined;

  const conditions: Record<string, unknown>[] = [];

  if (phone && phone.length >= 6) {
    const digits = phone.replace(/\D/g, "");
    conditions.push({ phone: { contains: digits.slice(-8) } });
  }
  if (instagram && instagram.length >= 2) {
    const handle = instagram.replace(/^@/, "");
    conditions.push({ instagram: { equals: handle, mode: "insensitive" } });
  }
  if (name && name.length >= 3) {
    conditions.push({ name: { contains: name, mode: "insensitive" } });
  }

  if (conditions.length === 0) return NextResponse.json({ duplicates: [] });

  const where: Record<string, unknown> = { OR: conditions };
  if (excludeId) where.id = { not: excludeId };

  const duplicates = await prisma.prospect.findMany({
    where,
    select: { id: true, name: true, phone: true, instagram: true, sector: true, status: true, neighborhood: true },
    take: 5,
  });

  return NextResponse.json({ duplicates });
}
