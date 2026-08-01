import { JobStatus } from "@prisma/client";

const ACTIVE_STATUS_VALUES = [
  "Pending",
  "WaitingForCustomerApproval",
  "Outsourced",
  "WarrantyPending",
  "WarrantyWithCompany",
  "Ready",
  "Return",
] as const;

const WARRANTY_STATUS_VALUES = [
  "WarrantyPending",
  "WarrantyWithCompany",
] as const;

/** Only statuses present in the loaded Prisma client (handles stale dev bundles). */
function knownStatuses(values: readonly string[]): JobStatus[] {
  const allowed = new Set(Object.values(JobStatus));
  return values.filter((s): s is JobStatus => allowed.has(s as JobStatus));
}

/** Active job statuses for Prisma `where.status.in` — server routes only. */
export const ACTIVE_JOB_STATUSES = knownStatuses(ACTIVE_STATUS_VALUES);

export const WARRANTY_JOB_STATUSES = knownStatuses(WARRANTY_STATUS_VALUES);

export function warrantyFieldsSupported(): boolean {
  return WARRANTY_JOB_STATUSES.length === WARRANTY_STATUS_VALUES.length;
}
