import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma, hasPrisma } from "@/lib/prisma";

/**
 * GET /api/admin/audit
 *
 * Returns paginated audit logs. Admin only.
 *
 * Query params:
 *   page     - 1-based page number (default 1)
 *   limit    - items per page (default 50, max 200)
 *   action   - filter by action type (e.g. "LOGIN", "CREATE_PROJECT")
 *   userId   - filter by user ID
 *   entity   - filter by entity type (e.g. "project", "lead")
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (!hasPrisma()) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
  const action = url.searchParams.get("action") || undefined;
  const userId = url.searchParams.get("userId") || undefined;
  const entity = url.searchParams.get("entity") || undefined;

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (entity) where.entity = entity;

  try {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error("[audit] GET error:", e);
    return NextResponse.json(
      { error: "Failed to fetch audit logs", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
