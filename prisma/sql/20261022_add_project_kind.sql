-- Add Project.kind (CLIENT | CONCEPT) and classify the existing client projects.
--
-- Reviewed manual migration. NOT applied by builds. Apply once, after approval:
--   npm run db:diff                      -- must show exactly the ALTER TABLE below
--   npx prisma db execute --file prisma/sql/20261022_add_project_kind.sql
--   npm run db:diff                      -- must then be an empty migration
--
-- Safety:
-- - Additive only. ADD COLUMN with a constant default is a metadata change on
--   Postgres 11+: no table rewrite, no existing value touched.
-- - Existing rows get 'CONCEPT'; the four client projects are then set to
--   'CLIENT' by id AND slug, so a mismatched id cannot reclassify the wrong row.
-- - One transaction: if the backfill does not hit exactly 4 rows, everything
--   (including the new column) is rolled back.
-- - Running it twice fails at ADD COLUMN and changes nothing.
-- - updated_at is not touched (it is maintained by Prisma, not by the database).

BEGIN;

ALTER TABLE "projects" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'CONCEPT';

DO $$
DECLARE
  updated integer;
BEGIN
  UPDATE "projects" AS p
     SET "kind" = 'CLIENT'
    FROM (VALUES
      ('cmpq9aea3000dukuwgepcivf5', 'terrene'),
      ('cmpq9afht000lukuw655b74wa', 'aylani-parfums'),
      ('cmpvz29x3000004la9fe12l1k', 'luxury-copro'),
      ('cmvjfyp21000008jsr6n1kzzc', 'dandana-cabaret')
    ) AS c(id, slug)
   WHERE p."id" = c.id AND p."slug" = c.slug;

  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated <> 4 THEN
    RAISE EXCEPTION 'Expected to classify 4 client projects, matched %. Rolling back.', updated;
  END IF;
END $$;

COMMIT;
