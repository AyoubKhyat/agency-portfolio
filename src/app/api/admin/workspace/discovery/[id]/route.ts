import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { hasPrisma } from "@/lib/prisma";
import { getDiscoveryWorkspace } from "@/lib/workspace/resolver";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const workspace = await getDiscoveryWorkspace(id);
  if (!workspace) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  return NextResponse.json(workspace);
}
