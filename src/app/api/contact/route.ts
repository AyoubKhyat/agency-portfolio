import { NextResponse } from "next/server";
import { contactLimiter } from "@/lib/rate-limit";
import { withApiLogging } from "@/lib/api-logger";
import { intakeLead, leadSchema, type Saved } from "@/lib/lead-intake";
import { forwardLead } from "@/lib/lead-forward";

async function contactHandler(req: Request) {
  // Rate limiting: max 3 contact submissions per minute per IP
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const rateResult = contactLimiter.check(ip);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateResult.resetMs / 1000)) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Honeypot check
  if (parsed.data.website) {
    return NextResponse.json({ success: true });
  }

  try {
    // With ADMIN_API_URL set (split storefront), the admin app owns the lead; otherwise save it here.
    const saved: Saved = process.env.ADMIN_API_URL ? await forwardLead(parsed.data) : await intakeLead(parsed.data);
    // The lead id goes only to the request that created the lead (the form needs
    // it to report a failed email). A resubmission never learns an existing id.
    return NextResponse.json(
      { success: true, stored: true, duplicate: saved.duplicate, leadId: saved.duplicate ? null : saved.leadId },
      { status: saved.duplicate ? 200 : 201 },
    );
  } catch (e) {
    // Not in the CRM. The form still sends its email notification and tells the
    // visitor exactly that, so report the real state instead of a false success.
    console.error("[contact] Lead could not be saved:", e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, stored: false }, { status: 503 });
  }
}

export const POST = withApiLogging("POST /api/contact", contactHandler);
