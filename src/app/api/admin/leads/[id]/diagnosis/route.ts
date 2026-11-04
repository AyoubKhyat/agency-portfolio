import { NextResponse } from "next/server";
import { requireTeam } from "@/lib/authz";
import { prisma, hasPrisma } from "@/lib/prisma";
import { DIAGNOSIS_SUBJECT } from "@/lib/diagnosis";
import { readControls, usageNow, workforceEnvEnabled } from "@/lib/ai-workforce/controls";
import { runInboundDiagnosis } from "@/lib/ai-workforce/inbound-diagnosis";

// The audit is capped at 15 seconds and the AI call at 45.
export const maxDuration = 60;

const DENY_MESSAGE: Record<string, string> = {
  KILL_SWITCH_ENV: "AI Workforce is switched off on this deployment.",
  KILL_SWITCH: "AI Workforce is switched off in Settings.",
  DAILY_CAP: "The limit of runs in 24 hours has been reached.",
  LEAD_RECENT_RUN: "This enquiry already had a run in the last 24 hours.",
};

/** Runs for this enquiry, newest first, and whether a new one could start. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id }, select: { subject: true } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [runs, controls, usage] = await Promise.all([
    prisma.aiRun.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    readControls(),
    usageNow(),
  ]);
  return NextResponse.json({
    eligible: lead.subject === DIAGNOSIS_SUBJECT,
    enabled: workforceEnvEnabled() && controls.enabled,
    aiEnabled: workforceEnvEnabled() && controls.enabled && controls.aiEnabled,
    usage: { ...usage, dailyRunCap: controls.dailyRunCap },
    runs,
  });
}

/** Starts a run. The only trigger is this request from a signed-in team member. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireTeam();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { id } = await params;
  const result = await runInboundDiagnosis(id, { userId: auth.session.userId, fullName: auth.session.fullName });
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
