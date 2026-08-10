import { Prisma } from "@prisma/client";
import { warrantyFieldsSupported } from "./prisma-statuses";

const jobListSelectBase = {
  id: true,
  jobNumber: true,
  status: true,
  applianceType: true,
  brand: true,
  complaint: true,
  receivedAt: true,
  readyAt: true,
  deliveredAt: true,
  serviceAmount: true,
  deliveryContactStatus: true,
  expectedDeliveryAt: true,
  customer: { select: { id: true, mobile: true, name: true } },
  assignedTechnician: { select: { name: true } },
  outsourcedTo: { select: { id: true, name: true } },
} satisfies Prisma.JobCardSelect;

const jobListSelectWarranty = {
  isWarranty: true,
  warrantyPurchaseDate: true,
  warrantyTakenAt: true,
} satisfies Prisma.JobCardSelect;

/** Resolve at query time so a stale dev Prisma bundle can omit warranty fields. */
export function getJobListSelect(): Prisma.JobCardSelect {
  return warrantyFieldsSupported()
    ? { ...jobListSelectBase, ...jobListSelectWarranty }
    : jobListSelectBase;
}

const jobPatchSelectBase = {
  id: true,
  status: true,
  serviceAmount: true,
  remarks: true,
  whatsappNotificationsOverride: true,
  readyAt: true,
  deliveredAt: true,
  assignedTechnician: { select: { id: true, name: true } },
  completedByTechnician: { select: { id: true, name: true } },
  outsourcedTo: { select: { id: true, name: true } },
  completedByOutsource: { select: { id: true, name: true } },
  accessories: true,
  outsourcedAt: true,
} satisfies Prisma.JobCardSelect;

const jobPatchSelectWarranty = {
  isWarranty: true,
  warrantyPurchaseDate: true,
  warrantyTakenAt: true,
} satisfies Prisma.JobCardSelect;

export function getJobPatchSelect(): Prisma.JobCardSelect {
  return warrantyFieldsSupported()
    ? { ...jobPatchSelectBase, ...jobPatchSelectWarranty }
    : jobPatchSelectBase;
}

/** @deprecated Use getJobListSelect() in API routes */
export const jobListSelect = getJobListSelect();

export type JobListRow = Prisma.JobCardGetPayload<{
  select: typeof jobListSelectBase & typeof jobListSelectWarranty;
}>;
