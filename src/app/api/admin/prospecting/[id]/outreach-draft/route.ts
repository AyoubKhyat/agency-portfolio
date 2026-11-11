import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerOrAdmin } from "@/lib/authz";
import { createRateLimiter } from "@/lib/rate-limit";
import { InvalidUrlError } from "@/lib/prospect-qualification";
import { draftForProspect } from "@/lib/prospect-outreach-draft";

/** Each draft re-reads someone else's site, so keep it to a person's pace. */
const limiter = createRateLimiter({ max: 10, windowMs: 60_000 });

const schema = z.object({
  language: z.enum(["fr", "en", "ar"]),
  channel: z.enum(["WHATSAPP", "INSTAGRAM"]).optional(),
}).strict();

/**
 * A first message drafted by code from a fresh check of the prospect's website.
 * Read-only: no AI, nothing stored, nothing sent. The person edits it, sends it themselves, then records it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerOrAdmin();
  if (auth.response) return auth.response;

  if (!limiter.check(auth.session.userId).allowed) {
    return NextResponse.json({ error: "Too many drafts. Wait a minute." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { id } = await params;
  try {
    const result = await draftForProspect(id, { ...parsed.data, senderName: auth.session.fullName });
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (err) {
    if (err instanceof InvalidUrlError) {
      return NextResponse.json({ ok: false, blockers: [{ code: "NO_WEBSITE", message: "The saved website isn't a public website address." }] }, { status: 409 });
    }
    console.error("[outreach-draft] draft failed");
    return NextResponse.json({ error: "The draft failed. Try again." }, { status: 500 });
  }
}
