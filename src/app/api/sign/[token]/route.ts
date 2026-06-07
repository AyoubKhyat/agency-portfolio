import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { z } from "zod";
import { prisma, hasPrisma } from "@/lib/prisma";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-dev-secret-do-not-use-in-prod"
);

async function verifySignToken(token: string): Promise<{ contractId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (typeof payload.contractId !== "string") return null;
    return { contractId: payload.contractId };
  } catch {
    return null;
  }
}

/**
 * GET /api/sign/[token]
 * Public endpoint -- the token IS the auth.
 * Returns contract details needed to display the signing page.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!hasPrisma()) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { token } = await params;
  const decoded = await verifySignToken(token);
  if (!decoded) {
    return NextResponse.json(
      { error: "Invalid or expired signing link" },
      { status: 401 }
    );
  }

  const contract = await prisma.contract.findUnique({
    where: { id: decoded.contractId },
    include: {
      client: { select: { companyName: true } },
      prospect: { select: { name: true } },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.status === "SIGNED" || contract.status === "ACTIVE" || contract.status === "COMPLETED") {
    return NextResponse.json(
      { error: "This contract has already been signed", alreadySigned: true },
      { status: 400 }
    );
  }

  if (contract.status === "CANCELLED") {
    return NextResponse.json(
      { error: "This contract has been cancelled" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    id: contract.id,
    title: contract.title,
    amount: contract.amount,
    currency: contract.currency,
    paymentTerms: contract.paymentTerms,
    notes: contract.notes,
    startDate: contract.startDate,
    endDate: contract.endDate,
    status: contract.status,
    partyName: contract.client?.companyName ?? contract.prospect?.name ?? null,
    agencyName: "Ibda3 Digital",
  });
}

const signSchema = z.object({
  signatureData: z
    .string()
    .min(1, "Signature is required")
    .refine((s) => s.startsWith("data:image/"), "Invalid signature format"),
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Valid email is required"),
});

/**
 * POST /api/sign/[token]
 * Public endpoint -- accept signature and mark contract as SIGNED.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!hasPrisma()) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { token } = await params;
  const decoded = await verifySignToken(token);
  if (!decoded) {
    return NextResponse.json(
      { error: "Invalid or expired signing link" },
      { status: 401 }
    );
  }

  const contract = await prisma.contract.findUnique({
    where: { id: decoded.contractId },
    select: { id: true, status: true },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.status === "SIGNED" || contract.status === "ACTIVE" || contract.status === "COMPLETED") {
    return NextResponse.json(
      { error: "This contract has already been signed" },
      { status: 400 }
    );
  }

  if (contract.status === "CANCELLED") {
    return NextResponse.json(
      { error: "This contract has been cancelled" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = signSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { signatureData, name, email } = parsed.data;

  // Extract IP from headers
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";

  const now = new Date();

  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: "SIGNED",
      signatureData,
      signedAt: now,
      signedByName: name,
      signedByEmail: email,
      signatureIp: ip,
      signedDate: now,
    },
  });

  return NextResponse.json({ success: true, signedAt: now.toISOString() });
}
