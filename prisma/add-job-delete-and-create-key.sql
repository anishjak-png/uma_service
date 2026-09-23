-- Soft-delete jobs and idempotent create keys. Do not run prisma db push
-- (it would drop spa_* tables that Prisma does not model).

ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'Deleted';

ALTER TABLE "JobCard" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "JobCard" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "JobCard" ADD COLUMN IF NOT EXISTS "deleteReason" TEXT;
ALTER TABLE "JobCard" ADD COLUMN IF NOT EXISTS "createKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "JobCard_createKey_key" ON "JobCard"("createKey");
