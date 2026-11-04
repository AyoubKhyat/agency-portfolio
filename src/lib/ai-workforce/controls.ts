/**
 * AI Workforce kill switch and budgets. Everything here fails closed: a missing row, a database error,
 * or an unset env var all mean "off". Caps live in the database, because in-memory counters don't
 * survive across serverless instances, and they are checked under a lock held for the transaction, so
 * two runs starting together can't both take the last slot.
 */
import { prisma } from "@/lib/prisma";

export const AI_MODEL = "claude-sonnet-5-5";
/** First-party rates at the time of writing, in millionths of a dollar per token ($2 and $10 per million). */
export const MICROS_PER_TOKEN = { input: 2, output: 10 } as const;
export const MAX_OUTPUT_TOKENS = 4000;
/** Prompts are refused above this, which keeps input cost predictable. */
export const MAX_PROMPT_CHARS = 16_000;
/** Allows for prompts that tokenise poorly, such as Arabic: never more than about 2 characters per token here. */
export const MAX_INPUT_TOKENS = 8000;
/** The most one AI call can cost. Held against the month's budget until the real usage is known. */
export const RESERVATION_MICROS = MAX_INPUT_TOKENS * MICROS_PER_TOKEN.input + MAX_OUTPUT_TOKENS * MICROS_PER_TOKEN.output;

/** Hard ceilings. The owner can lower these in Settings but not raise them. */
export const HARD_DAILY_RUN_CAP = 10;
export const HARD_MONTHLY_BUDGET_MICROS = 5_000_000;

export const RUN_WINDOW_MS = 24 * 60 * 60 * 1000;
/** A RUNNING row older than this belongs to a function that died. Its reservation stays counted. */
export const STALE_RUN_MS = 5 * 60 * 1000;
/** Keeps these locks apart from record-send's 7301. */
const BUDGET_LOCK = 7302;

export function costMicros(inputTokens: number, outputTokens: number): number {
  return inputTokens * MICROS_PER_TOKEN.input + outputTokens * MICROS_PER_TOKEN.output;
}

export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export const workforceEnvEnabled = () => process.env.AI_WORKFORCE_ENABLED === "1";

export type Controls = { enabled: boolean; aiEnabled: boolean; dailyRunCap: number; monthlyBudgetMicros: number };
const OFF: Controls = { enabled: false, aiEnabled: false, dailyRunCap: 0, monthlyBudgetMicros: 0 };

/** Current switches, with the hard ceilings applied. Off on a missing row or any read failure. */
export async function readControls(): Promise<Controls> {
  try {
    const row = await prisma.aiControl.findUnique({ where: { id: "singleton" } });
    if (!row) return OFF;
    return {
      enabled: row.enabled,
      aiEnabled: row.aiEnabled,
      dailyRunCap: Math.min(row.dailyRunCap, HARD_DAILY_RUN_CAP),
      monthlyBudgetMicros: Math.min(row.monthlyBudgetMicros, HARD_MONTHLY_BUDGET_MICROS),
    };
  } catch (err) {
    console.error("[ai-workforce] controls unavailable, treating as off:", err instanceof Error ? err.message : err);
    return OFF;
  }
}

/** Runs a transaction would count against the day: everything that actually started. */
const COUNTED = { status: { not: "DENIED" } };

export async function usageNow(now = new Date()) {
  const [runsInWindow, month] = await Promise.all([
    prisma.aiRun.count({ where: { ...COUNTED, createdAt: { gte: new Date(now.getTime() - RUN_WINDOW_MS) } } }),
    prisma.aiRun.aggregate({ where: { createdAt: { gte: monthStart(now) } }, _sum: { costMicros: true, reservedMicros: true } }),
  ]);
  return { runsInWindow, monthSpentMicros: (month._sum.costMicros ?? 0) + (month._sum.reservedMicros ?? 0) };
}

export type DenyReason = "KILL_SWITCH_ENV" | "KILL_SWITCH" | "DAILY_CAP" | "LEAD_RECENT_RUN";
export type AiWithheld = "AI_DISABLED" | "NO_API_KEY" | "BUDGET_EXHAUSTED";

export type Reservation =
  | { allowed: false; reason: DenyReason; runId: string }
  /** `aiWithheld` set: the audit may run, but no paid call may be made for this run. */
  | { allowed: true; runId: string; reservedMicros: number; aiWithheld: AiWithheld | null };

type ReserveInput = {
  leadId: string;
  targetUrl: string;
  agent: string;
  startedById: string;
  startedByName: string;
  aiKeyPresent: boolean;
  now?: Date;
};

/**
 * Starts a run, or records why it was refused. Every attempt leaves a row. Refused rows are DENIED and
 * don't use up the daily cap; anything that started counts, whatever its outcome.
 */
export async function reserveRun(input: ReserveInput): Promise<Reservation> {
  const now = input.now ?? new Date();
  const row = {
    agent: input.agent, leadId: input.leadId, targetUrl: input.targetUrl,
    startedById: input.startedById, startedByName: input.startedByName,
  };
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BUDGET_LOCK}::int)`;

    const deny = async (reason: DenyReason): Promise<Reservation> => {
      const denied = await tx.aiRun.create({ data: { ...row, status: "DENIED", errorCode: reason } });
      return { allowed: false, reason, runId: denied.id };
    };

    if (!workforceEnvEnabled()) return deny("KILL_SWITCH_ENV");
    const control = await tx.aiControl.findUnique({ where: { id: "singleton" } });
    if (!control?.enabled) return deny("KILL_SWITCH");

    await tx.aiRun.updateMany({
      where: { status: "RUNNING", createdAt: { lt: new Date(now.getTime() - STALE_RUN_MS) } },
      data: { status: "FAILED", errorCode: "STALE" },
    });

    const windowStart = new Date(now.getTime() - RUN_WINDOW_MS);
    const runsInWindow = await tx.aiRun.count({ where: { ...COUNTED, createdAt: { gte: windowStart } } });
    if (runsInWindow >= Math.min(control.dailyRunCap, HARD_DAILY_RUN_CAP)) return deny("DAILY_CAP");

    const leadRuns = await tx.aiRun.count({ where: { ...COUNTED, leadId: input.leadId, createdAt: { gte: windowStart } } });
    if (leadRuns > 0) return deny("LEAD_RECENT_RUN");

    const month = await tx.aiRun.aggregate({
      where: { createdAt: { gte: monthStart(now) } },
      _sum: { costMicros: true, reservedMicros: true },
    });
    const spent = (month._sum.costMicros ?? 0) + (month._sum.reservedMicros ?? 0);
    const budget = Math.min(control.monthlyBudgetMicros, HARD_MONTHLY_BUDGET_MICROS);

    let aiWithheld: AiWithheld | null = null;
    if (!control.aiEnabled) aiWithheld = "AI_DISABLED";
    else if (!input.aiKeyPresent) aiWithheld = "NO_API_KEY";
    else if (spent + RESERVATION_MICROS > budget) aiWithheld = "BUDGET_EXHAUSTED";

    const reservedMicros = aiWithheld ? 0 : RESERVATION_MICROS;
    const run = await tx.aiRun.create({ data: { ...row, status: "RUNNING", reservedMicros } });
    return { allowed: true, runId: run.id, reservedMicros, aiWithheld };
  }, { maxWait: 10_000, timeout: 15_000 });
}
