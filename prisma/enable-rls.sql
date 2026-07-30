-- Lock down Supabase PostgREST / Data API access for uma-service.
--
-- The Next.js app uses Prisma with the postgres connection string (server-side only).
-- It does NOT use the Supabase anon key for database reads/writes.
--
-- Without RLS, anyone with your project URL + anon key could read/write all tables
-- via https://[project].supabase.co/rest/v1/...
--
-- Run once in Supabase: SQL Editor → New query → paste → Run

-- 1. Enable (and force) RLS on every public table
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- 2. Remove API role access (anon + authenticated) from existing objects
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

-- 3. Default for future tables created by Prisma db push
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Prisma / postgres role keeps full access (BYPASSRLS). No anon policies needed.
