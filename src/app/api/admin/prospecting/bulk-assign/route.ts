import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bulkAssignOwner, logProspectActivity } from "@/lib/dal";
import { z } from "zod";

const schema = z.object({
  prospectIds: z.array(z.string()).min(1),
  ownerUserId: z.string().nullable(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await bulkAssignOwner(parsed.data.prospectIds, parsed.data.ownerUserId);

  await Promise.all(
    parsed.data.prospectIds.map((prospectId) =>
      logProspectActivity({
        prospectId,
        userId: session.userId,
        userName: session.fullName,
        actionType: "ASSIGNED",
        details: parsed.data.ownerUserId ? "Bulk assigned" : "Bulk unassigned",
      })
    )
  );

  return NextResponse.json({ success: true, count: parsed.data.prospectIds.length });
}
