import { NextResponse } from "next/server";
import { createLead } from "@/lib/dal";
import { z } from "zod";

const schema = z.object({
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(30).optional(),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(5000),
  website: z.string().optional(),
});

export async function POST(req: Request) {
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
    await createLead({ fullName, email, phone: phone || undefined, subject, message });
  } catch {
    // DB not available — still return success since EmailJS handles delivery
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
