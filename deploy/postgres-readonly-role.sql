-- Read-only role for the public storefront (task T033). Run as the database owner, once the
-- schema exists (after `npm run db:migrate`). Replace the password before running.
-- The storefront can then read the public tables and nothing else: no write, no leads,
-- no prospects, no users.
CREATE ROLE ibda3_site LOGIN PASSWORD 'CHANGE-ME-long-random';
GRANT CONNECT ON DATABASE ibda3 TO ibda3_site;
GRANT USAGE ON SCHEMA public TO ibda3_site;
GRANT SELECT ON projects, project_translations, blog_posts TO ibda3_site;
-- Future tables stay invisible to this role: no ALTER DEFAULT PRIVILEGES on purpose.

-- Check (as ibda3_site):
--   SELECT count(*) FROM projects;         -- works
--   SELECT count(*) FROM leads;            -- ERROR: permission denied
--   DELETE FROM projects;                  -- ERROR: permission denied
