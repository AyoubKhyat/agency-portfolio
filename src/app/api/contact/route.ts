import { NextResponse } from "next/server";
import { createLead, findRecentDuplicateLead, getLeastLoadedUser } from "@/lib/dal";
import { z } from "zod";
import { contactLimiter } from "@/lib/rate-limit";
import { withApiLogging } from "@/lib/api-logger";
import { dispatchWebhook } from "@/lib/webhooks";
import { notifyNewLead } from "@/lib/notify";

const schema = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(30).optional(),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(10).max(5000),
  website: z.string().optional(),
});

/** The same email + message + selected service inside this window is one inquiry, not a new lead. */
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

type Saved = { leadId: string | null; duplicate: boolean };

// Identical submissions arriving at the same time on this instance share one save
// (and its failure): only the first creates the lead and its notification.
const inFlight = new Map<string, Promise<Saved>>();

async function saveLead(data: z.infer<typeof schema>): Promise<Saved> {
  const { fullName, email, phone, subject, message } = data;
  const key = `${email.toLowerCase()}\n${subject}\n${message}`;
  const pending = inFlight.get(key);
  if (pending) return { leadId: (await pending).leadId, duplicate: true };

  const work = (async () => {
    const existing = await findRecentDuplicateLead(email, message, subject, new Date(Date.now() - DUPLICATE_WINDOW_MS));
    if (existing) return { leadId: existing, duplicate: true } as Saved;

    // Auto-assign lead to the team member with the fewest leads (round-robin)
    let assignedToId: string | undefined;
    let assignedToName: string | undefined;
    try {
      const leastLoaded = await getLeastLoadedUser();
      if (leastLoaded) {
        assignedToId = leastLoaded.id;
        assignedToName = leastLoaded.fullName;
      }
    } catch {
      // If user lookup fails, create lead without assignment
    }

    const lead = await createLead({
      fullName,
      email,
      phone: phone || undefined,
      subject,
      message,
      assignedToId,
      assignedToName,
    });

    await notifyNewLead({ id: lead.id, fullName, subject, assignedToId });

    // Fire webhook for new lead
    dispatchWebhook("lead.new", {
      id: lead.id,
      fullName,
      email,
      phone: phone || null,
      subject,
      message,
      assignedToName: assignedToName || null,
    });
    return { leadId: lead.id, duplicate: false } as Saved;
  })();

  inFlight.set(key, work);
  work.catch(() => {}); // the caller below observes the failure
  try {
    return await work;
  } finally {
    inFlight.delete(key);
  }
}

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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Honeypot check
  if (parsed.data.website) {
    return NextResponse.json({ success: true });
  }

  try {
    const saved = await saveLead(parsed.data);
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
