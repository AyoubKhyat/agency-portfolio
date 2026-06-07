import { prisma, hasPrisma } from "@/lib/prisma";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE_PROJECT"
  | "UPDATE_PROJECT"
  | "DELETE_PROJECT"
  | "TOGGLE_PROJECT_VISIBILITY"
  | "CREATE_LEAD"
  | "UPDATE_LEAD"
  | "RESET_PASSWORD"
  | "CREATE_PROSPECT"
  | "UPDATE_PROSPECT"
  | "DELETE_PROSPECT";

interface LogAuditParams {
  userId: string;
  userName: string;
  action: AuditAction | string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown> | string;
  ipAddress?: string;
}

/**
 * Write an entry to the audit_logs table.
 *
 * Fire-and-forget by default — errors are logged but never thrown so that
 * the calling route is not disrupted by audit failures.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  if (!hasPrisma()) return;

  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        action: params.action,
        entity: params.entity ?? null,
        entityId: params.entityId ?? null,
        details:
          typeof params.details === "string"
            ? params.details
            : params.details
              ? JSON.stringify(params.details)
              : null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err);
  }
}

/**
 * Extract client IP from a Request object (handles proxies).
 */
export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return undefined;
}
