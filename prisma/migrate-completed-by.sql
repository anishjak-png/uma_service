-- Add completed-by technician tracking (run after approval)
ALTER TABLE "JobCard" ADD COLUMN IF NOT EXISTS "completedByTechnicianId" TEXT;

CREATE INDEX IF NOT EXISTS "JobCard_completedByTechnicianId_idx"
  ON "JobCard"("completedByTechnicianId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'JobCard_completedByTechnicianId_fkey'
  ) THEN
    ALTER TABLE "JobCard"
      ADD CONSTRAINT "JobCard_completedByTechnicianId_fkey"
      FOREIGN KEY ("completedByTechnicianId")
      REFERENCES "Technician"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
