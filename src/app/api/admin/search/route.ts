import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ prospects: [], leads: [], notes: [] });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ prospects: [], leads: [], notes: [] });

  const [prospects, leads, notes] = await Promise.all([
    prisma.prospect.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { instagram: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { neighborhood: { contains: q, mode: "insensitive" } },
          { sector: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, sector: true, status: true, phone: true, instagram: true },
      take: 8,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.lead.findMany({
      where: {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { subject: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, fullName: true, email: true, status: true, subject: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.prospectNote.findMany({
      where: { content: { contains: q, mode: "insensitive" } },
      select: { id: true, content: true, prospectId: true, authorName: true, prospect: { select: { name: true } } },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ prospects, leads, notes });
}
