import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerOrAdmin } from "@/lib/authz";
import { createRateLimiter } from "@/lib/rate-limit";
import { InvalidUrlError, qualifyWebsite } from "@/lib/prospect-qualification";
import { SITE_URL_MAX } from "@/lib/diagnosis";

/** Each check reads someone else's site, so keep it to a person's pace. */
const limiter = createRateLimiter({ max: 10, windowMs: 60_000 });

const schema = z.object({ url: z.string().min(1).max(SITE_URL_MAX) }).strict();

/**
 * Check one website: audit, contact links found on it, existing prospects that match.
 * Read-only: no AI, no message, no prospect created, nothing written.
 */
export async function POST(req: Request) {
  const auth = await requireOwnerOrAdmin();
  if (auth.response) return auth.response;

  if (!limiter.check(auth.session.userId).allowed) {
    return NextResponse.json({ error: "Too many checks. Wait a minute." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a website address" }, { status: 400 });

  try {
    return NextResponse.json(await qualifyWebsite(parsed.data.url));
  } catch (err) {
    if (err instanceof InvalidUrlError) return NextResponse.json({ error: "That isn't a public website address" }, { status: 400 });
    console.error("[prospect-qualification] check failed");
    return NextResponse.json({ error: "The check failed. Try again." }, { status: 500 });
  }
}
