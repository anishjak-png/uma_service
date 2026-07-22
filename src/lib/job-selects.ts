import { Prisma } from "@prisma/client";

/** Fields returned by list/search endpoints (job cards, delivery, pending). */
export const jobListSelect = {
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
  customer: { select: { id: true, mobile: true, name: true } },
  assignedTechnician: { select: { name: true } },
} satisfies Prisma.JobCardSelect;

/** Fields returned by PATCH — client merges into existing job detail. */
export const jobPatchSelect = {
  id: true,
  status: true,
  serviceAmount: true,
  remarks: true,
  readyAt: true,
  deliveredAt: true,
  assignedTechnician: { select: { id: true, name: true } },
  completedByTechnician: { select: { id: true, name: true } },
} satisfies Prisma.JobCardSelect;

export type JobListRow = Prisma.JobCardGetPayload<{ select: typeof jobListSelect }>;
