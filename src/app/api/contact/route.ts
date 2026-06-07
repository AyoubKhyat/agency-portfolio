import { NextResponse } from "next/server";
import { createLead, getLeastLoadedUser } from "@/lib/dal";
import { z } from "zod";
import { contactLimiter } from "@/lib/rate-limit";
import { withApiLogging } from "@/lib/api-logger";

const schema = z.object({
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(30).optional(),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(5000),
  website: z.string().optional(),
});

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

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Honeypot check
  if (parsed.data.website) {
    return NextResponse.json({ success: true });
  }

  const { fullName, email, phone, subject, message } = parsed.data;
  try {
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

    await createLead({
      fullName,
      email,
      phone: phone || undefined,
      subject,
      message,
      assignedToId,
      assignedToName,
    });
  } catch {
    // DB not available — still return success since EmailJS handles delivery
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export const POST = withApiLogging("POST /api/contact", contactHandler);
