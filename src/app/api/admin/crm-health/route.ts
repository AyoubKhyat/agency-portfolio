import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ issues: [], score: 100 });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    missingOwner,
    missingPhone,
    missingInstagram,
    overdueFollowUps,
    totalProspects,
  ] = await Promise.all([
    prisma.prospect.count({ where: { ownerUserId: null, status: { notIn: ["A_ENVOYER"] } } }),
    prisma.prospect.count({ where: { phone: "" } }),
    prisma.prospect.count({ where: { instagram: "" } }),
    prisma.prospect.count({ where: { followUpDate: { lt: todayStart }, status: { notIn: ["REPONDU", "CONVERTI", "CLIENT", "LOST"] } } }),
    prisma.prospect.count(),
  ]);

  const issues = [];
  if (missingOwner > 0) issues.push({ type: "warning", label: "Missing owner", count: missingOwner });
  if (missingPhone > 0) issues.push({ type: "info", label: "Missing phone", count: missingPhone });
  if (missingInstagram > 0) issues.push({ type: "info", label: "Missing Instagram", count: missingInstagram });
  if (overdueFollowUps > 0) issues.push({ type: "error", label: "Overdue follow-ups", count: overdueFollowUps });

  const issueCount = missingOwner + overdueFollowUps;
  const score = totalProspects > 0 ? Math.max(0, Math.round(100 - (issueCount / totalProspects) * 100)) : 100;

  return NextResponse.json({ issues, score, totalProspects });
}
