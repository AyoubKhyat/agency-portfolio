import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

// Reads auth cookie — never cache, never prerender.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasPrisma()) return NextResponse.json({ templates: [] });

    const templates = await prisma.outreachTemplate.findMany({
      where: { isActive: true },
      select: { key: true, name: true, channel: true, language: true, body: true, subject: true },
      orderBy: { key: "asc" },
    });

    return NextResponse.json({ templates });
  } catch (err) {
    console.error("[GET /api/admin/outreach/templates] failed:", err);
    // Return empty list rather than 500 — client should never block WhatsApp opens because templates failed.
    return NextResponse.json({ templates: [] });
  }
}
