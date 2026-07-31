-- Run in Supabase SQL Editor after `npm run db:push`
-- Enables Realtime INSERT events for the Print Bridge

-- 1. Add PrintJob to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE "PrintJob";

-- 2. Migrate enum: Done -> Printed (skip if fresh DB)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PrintJobStatus' AND e.enumlabel = 'Done'
  ) THEN
    ALTER TYPE "PrintJobStatus" RENAME VALUE 'Done' TO 'Printed';
  END IF;
END $$;

-- 3. Rename error column (skip if already renamed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PrintJob' AND column_name = 'lastError'
  ) THEN
    ALTER TABLE "PrintJob" RENAME COLUMN "lastError" TO "errorMessage";
  END IF;
END $$;
