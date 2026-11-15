import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { bulkUpdateStatus, logProspectActivity } from "@/lib/dal";
import { z } from "zod";

const schema = z.object({
  prospectIds: z.array(z.string()).min(1),
  status: z.enum(["A_ENVOYER", "ENVOYE", "REPONDU", "PAS_DE_WHATSAPP", "CONVERTI", "MEETING", "PROPOSAL_SENT", "NEGOTIATION", "CLIENT", "LOST"]),
});

export async function POST(req: Request) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  const { session } = auth;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    await bulkUpdateStatus(parsed.data.prospectIds, parsed.data.status);

    for (const prospectId of parsed.data.prospectIds) {
      await logProspectActivity({
        prospectId,
        userId: session.userId,
        userName: session.fullName,
        actionType: `STATUS_${parsed.data.status}`,
        newStatus: parsed.data.status,
        details: `Bulk status change`,
      });
    }

    return NextResponse.json({ success: true, count: parsed.data.prospectIds.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Bulk status update failed" }, { status: 500 });
  }
}
