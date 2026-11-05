-- AI Workforce Phase 1: the run log and the kill switch / budget row.
--
-- Reviewed manual migration. NOT applied by builds. Apply once, after approval:
--   npm run db:diff                      -- must show exactly the statements below (without the INSERT)
--   npx prisma db execute --file prisma/sql/20261105_add_ai_workforce.sql
--   npm run db:diff                      -- must then be an empty migration
--
-- Safety:
-- - Additive only: two new tables, their indexes and one foreign key from ai_runs to leads
--   (ON DELETE SET NULL). No existing column or row is changed.
-- - The foreign key takes a brief SHARE ROW EXCLUSIVE lock on "leads", which blocks writes to that table
--   until the transaction commits. ai_runs is empty, so this should take milliseconds.
-- - Inserts one row, with everything switched off.
-- - One transaction: if any statement fails, nothing is created.
-- - Running it twice fails at CREATE TABLE and changes nothing.
-- - Rollback (only before any run has been recorded): DROP TABLE "ai_runs"; DROP TABLE "ai_controls";
-- - When the least-privilege role from Stage B exists, it needs:
--     GRANT SELECT, INSERT, UPDATE ON ai_runs TO ibda3_app;
--     GRANT SELECT, INSERT, UPDATE ON ai_controls TO ibda3_app;

BEGIN;

-- Give up instead of queueing lead writes behind this migration. On timeout nothing is created; just re-run.
SET LOCAL lock_timeout = '5s';

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" TEXT NOT NULL,
    "agent" TEXT NOT NULL DEFAULT 'INBOUND_DIAGNOSIS',
    "status" TEXT NOT NULL,
    "lead_id" TEXT,
    "target_url" TEXT NOT NULL,
    "final_url" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "findings" JSONB,
    "gap_score" INTEGER,
    "fit_label" TEXT,
    "duplicate_status" TEXT,
    "duplicate_reason" TEXT,
    "duplicate_prospect_id" TEXT,
    "draft_language" TEXT,
    "draft_subject" TEXT,
    "draft_body" TEXT,
    "approved_subject" TEXT,
    "approved_body" TEXT,
    "channel" TEXT,
    "model" TEXT,
    "prompt_version" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "reserved_micros" INTEGER NOT NULL DEFAULT 0,
    "cost_micros" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "error_code" TEXT,
    "error_detail" TEXT,
    "started_by_id" TEXT NOT NULL,
    "started_by_name" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_by_name" TEXT,
    "approved_at" TIMESTAMP(3),
    "sent_confirmed_by_id" TEXT,
    "sent_confirmed_by_name" TEXT,
    "sent_confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_controls" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT false,
    "daily_run_cap" INTEGER NOT NULL DEFAULT 10,
    "monthly_budget_micros" INTEGER NOT NULL DEFAULT 5000000,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_controls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_runs_lead_id_created_at_idx" ON "ai_runs"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_runs_created_at_idx" ON "ai_runs"("created_at");

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Everything starts off. The caps are the ceilings enforced in src/lib/ai-workforce/controls.ts.
INSERT INTO "ai_controls" ("id", "enabled", "ai_enabled", "daily_run_cap", "monthly_budget_micros", "updated_at")
VALUES ('singleton', false, false, 10, 5000000, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

COMMIT;
