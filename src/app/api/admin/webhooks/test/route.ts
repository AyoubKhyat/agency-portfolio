import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import { prisma, hasPrisma } from "@/lib/prisma";
import { sendTestWebhook } from "@/lib/webhooks";
import { z } from "zod";

// Tests a SAVED webhook: the URL and signing secret are read on the server, never sent by the browser.
const testSchema = z.object({
  id: z.string().min(1),
});

export async function POST(req: Request) {
  const auth = await requireOwner();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const webhook = await prisma.webhook.findUnique({ where: { id: parsed.data.id }, select: { url: true, secret: true } });
  if (!webhook) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await sendTestWebhook(webhook.url, webhook.secret);
  return NextResponse.json(result);
}
