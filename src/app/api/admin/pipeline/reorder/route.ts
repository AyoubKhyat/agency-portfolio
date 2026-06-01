import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  updates: z.array(z.object({
    id: z.string(),
    status: z.string(),
    sortOrder: z.number(),
  })),
});

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 500 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  for (const update of parsed.data.updates) {
    await prisma.clientProject.update({
      where: { id: update.id },
      data: { status: update.status, sortOrder: update.sortOrder },
    });
  }

  return NextResponse.json({ success: true });
}
