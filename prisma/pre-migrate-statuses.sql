-- Step 1 of migration: remap status values before enum replacement.
-- Run ONLY after explicit approval (superseded by migrate-workflow.sql which includes this logic).

ALTER TABLE "JobCard" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "StatusHistory" ALTER COLUMN "status" TYPE text USING "status"::text;

UPDATE "JobCard"
SET "status" = CASE "status"
  WHEN 'Received' THEN 'Pending'
  WHEN 'Diagnosing' THEN 'Pending'
  WHEN 'InRepair' THEN 'WaitingForCustomerApproval'
  WHEN 'Ready' THEN 'Ready'
  WHEN 'Delivered' THEN 'Delivered'
  WHEN 'Closed' THEN 'Delivered'
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
  ELSE 'Pending'
END;

UPDATE "JobCard" SET "brand" = 'Other' WHERE "brand" IS NULL OR TRIM("brand") = '';
