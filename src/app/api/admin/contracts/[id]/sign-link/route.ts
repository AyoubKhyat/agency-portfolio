import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-dev-secret-do-not-use-in-prod"
);

/**
 * POST /api/admin/contracts/[id]/sign-link
 * Admin-only. Generates a JWT signing token for the contract and returns the public URL.
 * Sets contract status to PENDING_SIGNATURE if currently DRAFT.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPrisma()) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { id: true, status: true, title: true },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.status === "SIGNED" || contract.status === "ACTIVE" || contract.status === "COMPLETED") {
    return NextResponse.json(
      { error: "Contract is already signed" },
      { status: 400 }
    );
  }

  if (contract.status === "CANCELLED") {
    return NextResponse.json(
      { error: "Cannot generate link for a cancelled contract" },
      { status: 400 }
    );
  }

  // Generate a JWT token valid for 7 days
  const token = await new SignJWT({ contractId: contract.id })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(SECRET);

  // If still DRAFT, move to PENDING_SIGNATURE
  if (contract.status === "DRAFT") {
    await prisma.contract.update({
      where: { id },
      data: { status: "PENDING_SIGNATURE" },
    });
  }

  // Build full URL from the request origin
  const fwdHost = req.headers.get("x-forwarded-host");
  const origin = req.headers.get("origin")
    || (fwdHost ? `https://${fwdHost}` : null)
    || new URL(req.url).origin;

  const signingUrl = `${origin}/sign/${token}`;

  return NextResponse.json({ url: signingUrl, token, expiresIn: "7 days" });
}
