import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { z } from "zod";
import { getProspectById, updateProspectStatus, createLead, logProspectActivity } from "@/lib/dal";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = z.object({ prospectId: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const prospect = await getProspectById(parsed.data.prospectId);
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  try {
    const lead = await createLead({
      fullName: prospect.name,
      email: "n/a",
      phone: prospect.phone || undefined,
      subject: `[Prospecting] ${prospect.sector}`,
      message: `Converted from prospecting.\nSector: ${prospect.sector}\nInstagram: ${prospect.instagram || "—"}\nNeighborhood: ${prospect.neighborhood || "—"}\nPhone: ${prospect.phone || "—"}\n\nNotes:\n${prospect.notes.map((n) => n.content).join("\n") || "—"}`,
    });

    await updateProspectStatus(parsed.data.prospectId, "CONVERTI");

    await logProspectActivity({
      prospectId: parsed.data.prospectId,
      userId: session.userId,
      userName: session.fullName,
      actionType: "STATUS_CONVERTI",
      previousStatus: prospect.status,
      newStatus: "CONVERTI",
      details: `Converted to lead #${lead.id}`,
    });

    return NextResponse.json({ leadId: lead.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to convert" }, { status: 500 });
  }
}
