import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, requireOwnerOrAdmin, requireTeam, sessionIsOwner } from "@/lib/authz";
import { prisma, hasPrisma } from "@/lib/prisma";
import { DIAGNOSIS_SUBJECT } from "@/lib/diagnosis";
import { readControls, usageNow, workforceEnvEnabled } from "@/lib/ai-workforce/controls";
import { runInboundDiagnosis } from "@/lib/ai-workforce/inbound-diagnosis";

// The audit is capped at 15 seconds and the AI call at 35. tests/inbound-diagnosis.test.ts keeps the margin.
export const maxDuration = 60;

const DENY_MESSAGE: Record<string, string> = {
  KILL_SWITCH_ENV: "AI Workforce is switched off on this deployment.",
  KILL_SWITCH: "AI Workforce is switched off in Settings.",
  DAILY_CAP: "The limit of runs in 24 hours has been reached.",
  LEAD_RECENT_RUN: "This enquiry already had a run in the last 24 hours.",
  RETRY_NOT_ALLOWED: "Only this enquiry's latest run can be retried, and only if it failed.",
};

/** No body starts a run. The owner's retry names the failed run it replaces. */
const startSchema = z.object({ retryOfRunId: z.string().min(1).max(64) }).strict().nullable();

/** Runs for this enquiry, newest first, and whether a new one could start. Any team member can read them. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { subject: true } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [runs, controls, usage, owner] = await Promise.all([
    prisma.aiRun.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    readControls(),
    usageNow(),
    sessionIsOwner(auth.session),
  ]);
  return NextResponse.json({
    eligible: lead.subject === DIAGNOSIS_SUBJECT,
    enabled: workforceEnvEnabled() && controls.enabled,
    aiEnabled: workforceEnvEnabled() && controls.enabled && controls.aiEnabled,
    usage: { ...usage, dailyRunCap: controls.dailyRunCap },
    viewer: { canAct: owner || isAdmin(auth.session), isOwner: owner },
    runs,
  });
}

/** Starts a run. The only trigger is this request from the signed-in owner or an admin. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnerOrAdmin();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = startSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const retryOfRunId = parsed.data?.retryOfRunId ?? null;
  if (retryOfRunId && !(await sessionIsOwner(auth.session))) {
    return NextResponse.json({ error: "Only the account owner can retry a failed run" }, { status: 403 });
  }

  const { id } = await params;
  const result = await runInboundDiagnosis(id, { userId: auth.session.userId, fullName: auth.session.fullName }, retryOfRunId);
  switch (result.kind) {
    case "not_found":
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    case "not_diagnosis":
      return NextResponse.json({ error: "This enquiry has no site address to check." }, { status: 422 });
    case "denied":
      return NextResponse.json({ error: DENY_MESSAGE[result.reason] ?? "Not allowed right now.", reason: result.reason, runId: result.runId }, { status: 429 });
    case "finished":
      return NextResponse.json({ runId: result.runId, status: result.status }, { status: 201 });
  }
}
