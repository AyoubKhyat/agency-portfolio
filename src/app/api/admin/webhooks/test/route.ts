import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendTestWebhook } from "@/lib/webhooks";
import { z } from "zod";

const testSchema = z.object({
  url: z.string().url(),
  secret: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const result = await sendTestWebhook(parsed.data.url, parsed.data.secret);
  return NextResponse.json(result);
}
