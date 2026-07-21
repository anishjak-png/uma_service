import { JobStatus, Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function generateJobNumber(): Promise<string> {
  const year = new Date().getFullYear();

  const sequence = await prisma.$transaction(async (tx) => {
    const existing = await tx.jobSequence.findUnique({ where: { year } });
    if (existing) {
      return tx.jobSequence.update({
        where: { year },
        data: { lastNum: existing.lastNum + 1 },
      });
    }
    return tx.jobSequence.create({
      data: { year, lastNum: 1 },
    });
  });

  const num = String(sequence.lastNum).padStart(6, "0");
  return `UMA-${year}-${num}`;
}

export type JobWithCustomer = Prisma.JobCardGetPayload<{
  include: { customer: true; statusHistory: true };
}>;

export function normalizeMobile(mobile: string): string {
  return mobile.replace(/\D/g, "").slice(-10);
}

export function formatMobileDisplay(mobile: string): string {
  const digits = normalizeMobile(mobile);
  if (digits.length !== 10) return mobile;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function daysSince(date: Date): number {
  const diff = Date.now() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export async function recordStatusChange(
  jobCardId: string,
  status: JobStatus,
  changedBy?: string,
  note?: string
) {
  return prisma.statusHistory.create({
    data: { jobCardId, status, changedBy, note },
  });
}
