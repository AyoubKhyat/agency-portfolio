import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

// ── CSV helpers ──────────────────────────────────────────────────

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Wrap in double-quotes if the value contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const body = rows.map((row) =>
    columns.map((col) => escapeCSV(row[col])).join(",")
  );
  return [header, ...body].join("\n");
}

// ── Exportable types ─────────────────────────────────────────────

const VALID_TYPES = ["prospects", "leads", "clients", "projects", "invoices"] as const;
type ExportType = (typeof VALID_TYPES)[number];

async function fetchProspects() {
  const rows = await prisma.prospect.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { fullName: true } },
    },
  });

  return {
    columns: [
      "name", "phone", "instagram", "sector", "neighborhood",
      "status", "priority", "owner", "sentAt", "createdAt",
    ],
    rows: rows.map((r) => ({
      name: r.name,
      phone: r.phone,
      instagram: r.instagram,
      sector: r.sector,
      neighborhood: r.neighborhood,
      status: r.status,
      priority: r.priority,
      owner: r.owner?.fullName ?? "",
      sentAt: r.sentAt?.toISOString() ?? "",
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

async function fetchLeads() {
  const rows = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
  });

  return {
    columns: [
      "fullName", "email", "phone", "subject", "message",
      "status", "assignedToName", "createdAt",
    ],
    rows: rows.map((r) => ({
      fullName: r.fullName,
      email: r.email,
      phone: r.phone ?? "",
      subject: r.subject,
      message: r.message,
      status: r.status,
      assignedToName: r.assignedToName ?? "",
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

async function fetchClients() {
  const rows = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      accountManager: { select: { fullName: true } },
    },
  });

  return {
    columns: [
      "name", "email", "phone", "sector", "status",
      "source", "totalValue", "createdAt",
    ],
    rows: rows.map((r) => ({
      name: r.companyName,
      email: r.email,
      phone: r.phone,
      sector: r.industry,
      status: r.status,
      source: r.acquisitionSource,
      totalValue: r.contractValue,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

async function fetchProjects() {
  const rows = await prisma.project.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return {
    columns: [
      "slug", "category", "url", "tag", "status",
      "visible", "sortOrder", "createdAt",
    ],
    rows: rows.map((r) => ({
      slug: r.slug,
      category: r.category,
      url: r.url,
      tag: r.tag,
      status: r.status,
      visible: r.visible,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

async function fetchInvoices() {
  // No Invoice model exists; export Proposals as the closest financial entity
  const rows = await prisma.proposal.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      prospect: { select: { name: true } },
      client: { select: { companyName: true } },
    },
  });

  return {
    columns: [
      "id", "prospectName", "clientName", "contactPerson", "services",
      "amount", "currency", "status", "sentAt", "createdByName", "createdAt",
    ],
    rows: rows.map((r) => ({
      id: r.id,
      prospectName: r.prospect?.name ?? "",
      clientName: r.client?.companyName ?? "",
      contactPerson: r.contactPerson,
      services: r.services,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      sentAt: r.sentAt?.toISOString() ?? "",
      createdByName: r.createdByName,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

// ── Route handler ────────────────────────────────────────────────

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPrisma()) {
    return NextResponse.json({ error: "Database not available" }, { status: 500 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ExportType | null;

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    let data: { columns: string[]; rows: Record<string, unknown>[] };

    switch (type) {
      case "prospects":
        data = await fetchProspects();
        break;
      case "leads":
        data = await fetchLeads();
        break;
      case "clients":
        data = await fetchClients();
        break;
      case "projects":
        data = await fetchProjects();
        break;
      case "invoices":
        data = await fetchInvoices();
        break;
    }

    if (data.rows.length === 0) {
      return new Response("", {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${type}-export.csv"`,
        },
      });
    }

    const csv = toCSV(data.rows, data.columns);

    // BOM prefix so Excel correctly detects UTF-8
    const bom = "﻿";

    return new Response(bom + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type}-export.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(`[export/csv] Error exporting ${type}:`, err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
