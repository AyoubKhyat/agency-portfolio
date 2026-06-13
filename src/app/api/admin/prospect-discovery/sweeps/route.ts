import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const logSchema = z.object({
  provider: z.enum(["GOOGLE", "OSM"]),
  city: z.string().min(1),
  sector: z.string().min(1),
  neighborhood: z.string().nullable().optional(),
  keyword: z.string().nullable().optional(),
  resultCount: z.number().int().min(0),
  uniqueCount: z.number().int().min(0),
  duplicateCount: z.number().int().min(0).default(0),
  status: z.enum(["COMPLETED", "FAILED", "CANCELLED"]).default("COMPLETED"),
  error: z.string().nullable().optional(),
  startedAt: z.string().optional(), // ISO; if omitted server uses now
});

// GET — list recent sweeps for the dashboard.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ sweeps: [] });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);
  const sweeps = await prisma.discoverySweep.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ sweeps });
}

// POST — log a completed (or failed) sweep query result.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = logSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
  }

  const startedAt = parsed.data.startedAt ? new Date(parsed.data.startedAt) : new Date();
  const sweep = await prisma.discoverySweep.create({
    data: {
      provider: parsed.data.provider,
      city: parsed.data.city,
      sector: parsed.data.sector,
      neighborhood: parsed.data.neighborhood || null,
      keyword: parsed.data.keyword || null,
      resultCount: parsed.data.resultCount,
      uniqueCount: parsed.data.uniqueCount,
      duplicateCount: parsed.data.duplicateCount,
      status: parsed.data.status,
      error: parsed.data.error || null,
      startedAt,
      completedAt: new Date(),
      startedById: session.userId,
      startedByName: session.fullName,
    },
  });

  return NextResponse.json(sweep, { status: 201 });
}
