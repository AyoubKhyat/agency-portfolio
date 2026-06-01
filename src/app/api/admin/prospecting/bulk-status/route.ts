import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bulkUpdateStatus, logProspectActivity } from "@/lib/dal";
import { z } from "zod";

const schema = z.object({
  prospectIds: z.array(z.string()).min(1),
  status: z.enum(["A_ENVOYER", "ENVOYE", "REPONDU", "PAS_DE_WHATSAPP", "CONVERTI", "MEETING", "PROPOSAL_SENT", "NEGOTIATION", "CLIENT", "LOST"]),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await bulkUpdateStatus(parsed.data.prospectIds, parsed.data.status);

  await Promise.all(
    parsed.data.prospectIds.map((prospectId) =>
      logProspectActivity({
        prospectId,
        userId: session.userId,
        userName: session.fullName,
        actionType: `STATUS_${parsed.data.status}`,
        newStatus: parsed.data.status,
        details: `Bulk status change`,
      })
    )
  );

  return NextResponse.json({ success: true, count: parsed.data.prospectIds.length });
}
