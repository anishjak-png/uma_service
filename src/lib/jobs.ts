import { JobStatus, Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function generateJobNumber(): Promise<string> {
  const sequence = await prisma.$transaction(async (tx) => {
    const existing = await tx.jobSequence.findUnique({ where: { id: 1 } });
    if (existing) {
      return tx.jobSequence.update({
        where: { id: 1 },
        data: { lastNum: existing.lastNum + 1 },
      });
    }
    return tx.jobSequence.create({
      data: { id: 1, lastNum: 1 },
    });
  });

  return `UT ${sequence.lastNum}`;
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

export function parseProductPhotos(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
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

/** Display label for status history "Updated By" (reception → Reception, etc.). */
export function formatStatusChangedBy(changedBy: string | null | undefined): string {
  if (!changedBy) return "System";
  const lower = changedBy.toLowerCase();
  if (lower === "reception") return "Reception";
  if (lower === "admin") return "Admin";
  if (lower === "technician") return "Technician";
  return changedBy;
}
