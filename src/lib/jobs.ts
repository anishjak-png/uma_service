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

export type SearchQueryType = "empty" | "mobile" | "ut" | "name";

export function detectSearchQueryType(q: string): SearchQueryType {
  const trimmed = q.trim();
  if (!trimmed) return "empty";

  const compact = trimmed.replace(/\s+/g, " ");
  if (/^ut\s*\d+$/i.test(compact)) return "ut";

  const mobile = normalizeMobile(trimmed);
  if (mobile.length === 10 && /^[\d\s+\-()]+$/.test(trimmed)) return "mobile";

  return "name";
}

/** Normalizes "ut1", "UT  12" → "UT 12" for exact job number lookup. */
export function normalizeJobNumberQuery(q: string): string {
  const match = q.trim().match(/^ut\s*(\d+)$/i);
  if (match) return `UT ${match[1]}`;
  return q.trim().toUpperCase();
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

/** Date and time for job timestamps (received, completed, delivered). */
export function formatDateTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
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

export function parseAccessories(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((a) => typeof a === "string") : [];
  } catch {
    return [];
  }
}

export function serializeAccessories(items: string[]): string | null {
  const cleaned = items.map((a) => a.trim()).filter(Boolean);
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
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

/** Display label for status history "Updated By" (staff name or role). */
export function formatStatusChangedBy(changedBy: string | null | undefined): string {
  if (!changedBy) return "System";
  const lower = changedBy.toLowerCase();
  if (lower === "reception") return "Reception";
  if (lower === "admin") return "Admin";
  if (lower === "technician") return "Technician";
  return changedBy;
}

export function staffActorName(session: {
  staffName?: string;
  technicianName?: string;
  role?: string;
}): string {
  if (session.staffName?.trim()) return session.staffName.trim();
  if (session.role === "technician" && session.technicianName) {
    return session.technicianName;
  }
  if (session.role === "reception") return "Reception";
  if (session.role === "admin") return "Admin";
  if (session.role === "technician") return "Technician";
  return "Staff";
}
