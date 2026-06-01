import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPrisma()) return NextResponse.json({ error: "No database" }, { status: 500 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "prospects";
  const format = url.searchParams.get("format") || "csv";

  let rows: Record<string, unknown>[] = [];

  if (type === "prospects") {
    rows = await prisma.prospect.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        name: true, phone: true, sector: true, neighborhood: true,
        instagram: true, hasWebsite: true, status: true, priority: true,
        sentAt: true, followUpDate: true, ownerUserId: true,
        sentByName: true, lastActionByName: true, lastActionAt: true,
        proposalAmount: true, proposalStatus: true, createdAt: true,
      },
    });
  } else if (type === "clients") {
    rows = await prisma.prospect.findMany({
      where: { status: { in: ["CLIENT", "CONVERTI"] } },
      orderBy: { updatedAt: "desc" },
      select: {
        name: true, phone: true, sector: true, neighborhood: true,
        instagram: true, status: true, proposalAmount: true,
        sentByName: true, createdAt: true, updatedAt: true,
      },
    });
  } else if (type === "projects") {
    rows = await prisma.clientProject.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        name: true, clientName: true, services: true, status: true,
        priority: true, budget: true, amountPaid: true, progress: true,
        ownerName: true, startDate: true, dueDate: true, createdAt: true,
      },
    });
  } else if (type === "activities") {
    rows = await prisma.prospectActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: {
        userName: true, actionType: true, details: true, createdAt: true,
        prospect: { select: { name: true, sector: true } },
      },
    });
    rows = rows.map((r) => ({
      ...r,
      prospectName: (r.prospect as { name: string })?.name,
      prospectSector: (r.prospect as { sector: string })?.sector,
      prospect: undefined,
    }));
  }

  if (format === "json") {
    return NextResponse.json(rows, {
      headers: { "Content-Disposition": `attachment; filename="${type}-export.json"` },
    });
  }

  if (rows.length === 0) return new Response("No data", { status: 200 });

  const headers = Object.keys(rows[0]).filter((k) => k !== "prospect");
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = (row as Record<string, unknown>)[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    ),
  ];

  return new Response(csvRows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-export.csv"`,
    },
  });
}
