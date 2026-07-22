-- Complete schema migration for simplified Uma Service workflow.
-- Run ONLY after explicit approval:
--   npx prisma db execute --file prisma/migrate-workflow.sql --schema prisma/schema.prisma

-- 1. Convert status columns to text if still enum (safe to re-run)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'JobCard' AND column_name = 'status'
      AND udt_name = 'JobStatus'
  ) THEN
    ALTER TABLE "JobCard" ALTER COLUMN "status" TYPE text USING "status"::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'StatusHistory' AND column_name = 'status'
      AND udt_name = 'JobStatus'
  ) THEN
    ALTER TABLE "StatusHistory" ALTER COLUMN "status" TYPE text USING "status"::text;
  END IF;
END $$;

UPDATE "JobCard"
SET "status" = CASE "status"
  WHEN 'Received' THEN 'Pending'
  WHEN 'Diagnosing' THEN 'Pending'
  WHEN 'InRepair' THEN 'WaitingForCustomerApproval'
  WHEN 'Ready' THEN 'Ready'
  WHEN 'Delivered' THEN 'Delivered'
  WHEN 'Closed' THEN 'Delivered'
  WHEN 'Pending' THEN 'Pending'
  WHEN 'WaitingForCustomerApproval' THEN 'WaitingForCustomerApproval'
  WHEN 'Return' THEN 'Return'
  ELSE 'Pending'
END;

UPDATE "StatusHistory"
SET "status" = CASE "status"
  WHEN 'Received' THEN 'Pending'
  WHEN 'Diagnosing' THEN 'Pending'
  WHEN 'InRepair' THEN 'WaitingForCustomerApproval'
  WHEN 'Ready' THEN 'Ready'
  WHEN 'Delivered' THEN 'Delivered'
  WHEN 'Closed' THEN 'Delivered'
  WHEN 'Pending' THEN 'Pending'
  WHEN 'WaitingForCustomerApproval' THEN 'WaitingForCustomerApproval'
  WHEN 'Return' THEN 'Return'
  ELSE 'Pending'
END;

UPDATE "JobCard" SET "brand" = 'Other' WHERE "brand" IS NULL OR TRIM("brand") = '';

-- 2. Replace JobStatus enum
DROP TYPE IF EXISTS "JobStatus_new";
CREATE TYPE "JobStatus_new" AS ENUM (
  'Pending',
  'WaitingForCustomerApproval',
  'Ready',
  'Return',
  'Delivered'
);

ALTER TABLE "JobCard" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "JobCard"
  ALTER COLUMN "status" TYPE "JobStatus_new" USING "status"::"JobStatus_new";
ALTER TABLE "JobCard" ALTER COLUMN "status" SET DEFAULT 'Pending';

ALTER TABLE "StatusHistory"
  ALTER COLUMN "status" TYPE "JobStatus_new" USING "status"::"JobStatus_new";

DROP TYPE IF EXISTS "JobStatus";
ALTER TYPE "JobStatus_new" RENAME TO "JobStatus";

-- 3. JobCard columns (model is RETAINED)
ALTER TABLE "JobCard" ADD COLUMN IF NOT EXISTS "physicalCondition" TEXT;
ALTER TABLE "JobCard" ADD COLUMN IF NOT EXISTS "productPhotos" TEXT;
ALTER TABLE "JobCard" ADD COLUMN IF NOT EXISTS "remarks" TEXT;

ALTER TABLE "JobCard" DROP COLUMN IF EXISTS "finalCost";
ALTER TABLE "JobCard" DROP COLUMN IF EXISTS "internalNotes";
ALTER TABLE "JobCard" DROP COLUMN IF EXISTS "receiptSlipReturned";
ALTER TABLE "JobCard" DROP COLUMN IF EXISTS "deliveryNote";
ALTER TABLE "JobCard" DROP COLUMN IF EXISTS "deliveredBy";
ALTER TABLE "JobCard" DROP COLUMN IF EXISTS "readyWhatsappSent";
ALTER TABLE "JobCard" DROP COLUMN IF EXISTS "readyWhatsappSentAt";
ALTER TABLE "JobCard" DROP COLUMN IF EXISTS "attendedTechnicianId";
ALTER TABLE "JobCard" DROP COLUMN IF EXISTS "deliverySignature";

ALTER TABLE "JobCard" ALTER COLUMN "brand" SET NOT NULL;

-- 4. Global job sequence (UT 1, UT 2, …)
CREATE TABLE IF NOT EXISTS "JobSequence_new" (
  "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  "lastNum" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "JobSequence_new" ("id", "lastNum")
SELECT 1, COALESCE((SELECT COUNT(*)::int FROM "JobCard"), 0)
ON CONFLICT ("id") DO UPDATE SET "lastNum" = EXCLUDED."lastNum";

DROP TABLE IF EXISTS "JobSequence";
ALTER TABLE "JobSequence_new" RENAME TO "JobSequence";
