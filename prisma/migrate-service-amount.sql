-- Add service amount field (run after approval)
ALTER TABLE "JobCard" ADD COLUMN IF NOT EXISTS "serviceAmount" DOUBLE PRECISION;
