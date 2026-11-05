-- Optional indexes for the technician monthly performance report.
-- Run in Supabase SQL editor. Do not use prisma db push.
CREATE INDEX IF NOT EXISTS "JobCard_readyAt_idx" ON "JobCard" ("readyAt");
CREATE INDEX IF NOT EXISTS "JobCard_deliveredAt_idx" ON "JobCard" ("deliveredAt");
CREATE INDEX IF NOT EXISTS "JobCard_completedByTechnicianId_readyAt_idx"
  ON "JobCard" ("completedByTechnicianId", "readyAt");
CREATE INDEX IF NOT EXISTS "StatusHistory_jobCardId_changedAt_idx"
  ON "StatusHistory" ("jobCardId", "changedAt");
