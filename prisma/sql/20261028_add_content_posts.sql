-- Add the content_posts table for the Instagram Content Planner (/admin/content).
--
-- Reviewed manual migration. NOT applied by builds. Apply once, after approval:
--   npm run db:diff                      -- must show exactly the CREATE TABLE + 4 indexes below
--   npx prisma db execute --file prisma/sql/20261028_add_content_posts.sql
--   npm run db:diff                      -- must then be an empty migration
--
-- Safety:
-- - Additive only: one new table and its indexes. No existing table, column or row is
--   read, changed or locked (no foreign keys to other tables).
-- - Inserts no rows. The 30-day calendar is loaded separately by
--   scripts/import-content-calendar.ts, after its own approval.
-- - One transaction: if any statement fails, nothing is created.
-- - Running it twice fails at CREATE TABLE and changes nothing.
-- - Rollback (only while the table is still empty): DROP TABLE "content_posts";
-- - Statements are exactly what `prisma migrate diff` generates for the schema change.

BEGIN;

CREATE TABLE "content_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "planned_at" TIMESTAMP(3),
    "pillar" TEXT NOT NULL DEFAULT '',
    "hook" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "hashtags" TEXT NOT NULL DEFAULT '',
    "cta" TEXT NOT NULL DEFAULT '',
    "media_paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "next_action" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "published_at" TIMESTAMP(3),
    "published_url" TEXT NOT NULL DEFAULT '',
    "views" INTEGER,
    "reach" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "saves" INTEGER,
    "shares" INTEGER,
    "follows" INTEGER,
    "metrics_updated_at" TIMESTAMP(3),
    "source_key" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_posts_source_key_key" ON "content_posts"("source_key");
CREATE INDEX "content_posts_status_idx" ON "content_posts"("status");
CREATE INDEX "content_posts_planned_at_idx" ON "content_posts"("planned_at");
CREATE INDEX "content_posts_archived_at_idx" ON "content_posts"("archived_at");

COMMIT;
