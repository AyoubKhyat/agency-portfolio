import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTeam } from "@/lib/authz";
import { hasPrisma } from "@/lib/prisma";
import { applyRunAction } from "@/lib/ai-workforce/inbound-diagnosis";

const text = {
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
};
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), ...text }),
  z.object({ action: z.literal("approve"), ...text, channel: z.enum(["EMAIL", "WHATSAPP"]) }),
  z.object({ action: z.literal("discard") }),
  z.object({ action: z.literal("confirm_sent") }),
]);

const STATUS = { not_found: 404, wrong_state: 409, quality: 422, no_phone: 422 } as const;

/** Save, approve, discard, or record that a person sent the approved text. Nothing here sends anything. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { id, runId } = await params;
  const result = await applyRunAction(id, runId, parsed.data, { userId: auth.session.userId, fullName: auth.session.fullName });
  if (!result.ok) return NextResponse.json({ error: result.code, detail: result.detail }, { status: STATUS[result.code] });
  return NextResponse.json(result);
}
