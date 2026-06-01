import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 500 });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalProspects,
    missingOwnerContacted,
    missingPhone,
    missingInstagram,
    overdueFollowUps,
    staleProposals,
    orphanedActivities,
    totalActivities,
    totalNotes,
    totalProposals,
    totalProjects,
    totalUsers,
    dbSize,
  ] = await Promise.all([
    prisma.prospect.count(),
    prisma.prospect.count({ where: { ownerUserId: null, status: { notIn: ["A_ENVOYER"] } } }),
    prisma.prospect.count({ where: { phone: "" } }),
    prisma.prospect.count({ where: { instagram: "" } }),
    prisma.prospect.count({ where: { followUpDate: { lt: todayStart }, status: { notIn: ["REPONDU", "CONVERTI", "CLIENT", "LOST"] } } }),
    prisma.proposal.count({ where: { status: "DRAFT", updatedAt: { lt: new Date(Date.now() - 14 * 86400000) } } }),
    prisma.prospectActivity.count(),
    prisma.prospectActivity.count(),
    prisma.prospectNote.count(),
    prisma.proposal.count(),
    prisma.clientProject.count(),
    prisma.user.count(),
    Promise.resolve(0),
  ]);

  const duplicatePhones = await prisma.$queryRaw`
    SELECT phone, COUNT(*) as cnt FROM prospects
    WHERE phone != '' GROUP BY phone HAVING COUNT(*) > 1
  ` as { phone: string; cnt: bigint }[];

  const duplicateInstagrams = await prisma.$queryRaw`
    SELECT instagram, COUNT(*) as cnt FROM prospects
    WHERE instagram != '' GROUP BY instagram HAVING COUNT(*) > 1
  ` as { instagram: string; cnt: bigint }[];

  const issues = [];
  if (missingOwnerContacted > 0) issues.push({ type: "warning", label: "Contacted without owner", count: missingOwnerContacted, severity: "high" });
  if (overdueFollowUps > 0) issues.push({ type: "error", label: "Overdue follow-ups", count: overdueFollowUps, severity: "high" });
  if (duplicatePhones.length > 0) issues.push({ type: "warning", label: "Duplicate phone numbers", count: duplicatePhones.length, severity: "medium" });
  if (duplicateInstagrams.length > 0) issues.push({ type: "warning", label: "Duplicate Instagram handles", count: duplicateInstagrams.length, severity: "medium" });
  if (staleProposals > 0) issues.push({ type: "info", label: "Stale draft proposals (14+ days)", count: staleProposals, severity: "low" });
  if (missingPhone > 0) issues.push({ type: "info", label: "Missing phone number", count: missingPhone, severity: "low" });
  if (missingInstagram > 0) issues.push({ type: "info", label: "Missing Instagram", count: missingInstagram, severity: "low" });

  const score = totalProspects > 0
    ? Math.max(0, Math.round(100 - ((missingOwnerContacted + overdueFollowUps + duplicatePhones.length * 2) / totalProspects) * 100))
    : 100;

  return NextResponse.json({
    score,
    issues,
    stats: {
      totalProspects, totalActivities, totalNotes, totalProposals, totalProjects, totalUsers,
    },
    duplicates: {
      phones: duplicatePhones.map((d) => ({ value: d.phone, count: Number(d.cnt) })),
      instagrams: duplicateInstagrams.map((d) => ({ value: d.instagram, count: Number(d.cnt) })),
    },
  });
}
