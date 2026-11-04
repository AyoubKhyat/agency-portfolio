import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { prisma, hasPrisma } from "@/lib/prisma";
import { hasAnthropic } from "@/lib/anthropic";
import {
  AI_MODEL, HARD_DAILY_RUN_CAP, HARD_MONTHLY_BUDGET_MICROS, readControls, usageNow, workforceEnvEnabled,
} from "@/lib/ai-workforce/controls";

const schema = z.object({
  enabled: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  dailyRunCap: z.number().int().min(0).max(HARD_DAILY_RUN_CAP).optional(),
  monthlyBudgetMicros: z.number().int().min(0).max(HARD_MONTHLY_BUDGET_MICROS).optional(),
}).strict();

export async function GET() {
  const auth = await requireOwner();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const [controls, usage] = await Promise.all([readControls(), usageNow()]);
  return NextResponse.json({
    ...controls, ...usage, model: AI_MODEL,
    envEnabled: workforceEnvEnabled(), keyPresent: hasAnthropic(),
    hardDailyRunCap: HARD_DAILY_RUN_CAP, hardMonthlyBudgetMicros: HARD_MONTHLY_BUDGET_MICROS,
  });
}

/** The switch takes effect on the next check, with no redeploy. Caps can be lowered, never raised past the ceilings. */
export async function PATCH(req: Request) {
  const auth = await requireOwner();
  if (auth.response) return auth.response;
  if (!hasPrisma()) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await prisma.aiControl.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...parsed.data, updatedById: auth.session.userId },
    update: { ...parsed.data, updatedById: auth.session.userId },
  });
  await logAudit({
    userId: auth.session.userId, userName: auth.session.fullName,
    action: "AI_CONTROLS_CHANGED", entity: "ai_controls", entityId: "singleton", details: parsed.data,
  });
  return NextResponse.json(await readControls());
}
