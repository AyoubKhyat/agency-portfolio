import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPrisma } from "@/lib/prisma";
import { getProspectWorkspace } from "@/lib/workspace/resolver";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const workspace = await getProspectWorkspace(id);
  if (!workspace) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  return NextResponse.json(workspace);
}
