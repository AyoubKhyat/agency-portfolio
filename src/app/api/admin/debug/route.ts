import { NextResponse } from "next/server";
import { prisma, hasPrisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/authz";

export async function GET() {
  const auth = await requireOwner();
  if (auth.response) return auth.response;

  const info: Record<string, unknown> = { hasPrisma: hasPrisma() };

  if (hasPrisma()) {
    try {
      info.userCount = await prisma.user.count();
      info.adminUserCount = await prisma.adminUser.count();
      info.prospectCount = await prisma.prospect.count();
      info.activityCount = await prisma.prospectActivity.count();
      info.proposalCount = await prisma.proposal.count();
      info.projectCount = await prisma.clientProject.count();
    } catch (e) {
      info.error = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(info);
}
