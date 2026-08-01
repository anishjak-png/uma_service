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

/** URL path segment for tracking links — no spaces (WhatsApp-safe). */
export function toTrackingPathSlug(jobNumber: string): string {
  return normalizeJobNumberQuery(jobNumber).replace(/\s+/g, "");
}

/** Decode /j/[slug] back to stored job number format. */
export function jobNumberFromTrackingPath(pathSegment: string): string {
  let decoded = pathSegment.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // use raw segment when not percent-encoded
  }
  return normalizeJobNumberQuery(decoded.replace(/\+/g, " "));
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

/** Oldest received first — jobs with the most pending days appear at the top. */
export function sortJobsByPendingDays<T extends { receivedAt: string }>(
  jobs: T[]
): T[] {
  return [...jobs].sort(
    (a, b) =>
      new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
  );
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

/** Date-only display (purchase date, etc.). */
export function formatDate(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Parse optional YYYY-MM-DD into a UTC midnight Date, or null to clear. */
export function parseOptionalDateInput(
  value: unknown
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return date;
}

/** Format a Date/ISO string as YYYY-MM-DD for date inputs. */
export function toDateInputValue(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parsePhotoUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

/** @deprecated Use parsePhotoUrls */
export const parseProductPhotos = parsePhotoUrls;

export const parseWarrantyCardPhotos = parsePhotoUrls;

export type AccessoryItem = {
  name: string;
  qty: number;
};

function normalizeAccessoryQty(value: unknown): number {
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty < 1) return 1;
  return Math.min(999, Math.floor(qty));
}

/** Parse stored accessories. Supports legacy `["Remote"]` and `{ name, qty }` objects. */
export function parseAccessories(raw: string | null | undefined): AccessoryItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (typeof entry === "string") {
        const name = entry.trim();
        return name ? [{ name, qty: 1 }] : [];
      }
      if (entry && typeof entry === "object" && typeof entry.name === "string") {
        const name = entry.name.trim();
        if (!name) return [];
        return [{ name, qty: normalizeAccessoryQty(entry.qty) }];
      }
      return [];
    });
  } catch {
    return [];
  }
}

export function serializeAccessories(items: AccessoryItem[]): string | null {
  const cleaned = items
    .map((item) => ({
      name: item.name.trim(),
      qty: normalizeAccessoryQty(item.qty),
    }))
    .filter((item) => item.name);
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

export function formatAccessoryLabel(item: AccessoryItem): string {
  return item.qty > 1 ? `${item.name} ×${item.qty}` : item.name;
}

export function formatAccessoriesList(items: AccessoryItem[]): string {
  return items.map(formatAccessoryLabel).join(", ");
}

export function accessoryNames(items: AccessoryItem[]): string[] {
  return items.map((item) => item.name);
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
