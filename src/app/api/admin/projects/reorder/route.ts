import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { reorderProjects } from "@/lib/dal";
import { z } from "zod";

const schema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

export async function PUT(req: Request) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await reorderProjects(parsed.data.orderedIds);
  return NextResponse.json({ success: true });
}
