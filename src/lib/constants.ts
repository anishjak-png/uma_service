export const APP_NAME = "UMA SERVICE";
export const SHOP_NAME = process.env.NEXT_PUBLIC_SHOP_NAME ?? "Uma Traders";
export const SHOP_PHONE = process.env.NEXT_PUBLIC_SHOP_PHONE ?? "";

/** Public base URL for tracking links, receipts, etc. */
function resolveAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) {
    const host = production.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

export const APP_URL = resolveAppUrl();

export const MAX_PRODUCT_PHOTOS = 3;

export const JOB_STATUSES = [
  "Pending",
  "WaitingForCustomerApproval",
  "Outsourced",
  "Ready",
  "Return",
  "Delivered",
] as const;

export type JobStatusValue = (typeof JOB_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  Pending: "Pending",
  WaitingForCustomerApproval: "Waiting for Customer Approval",
  Outsourced: "Outsourced",
  Ready: "Ready",
  Return: "Return",
  Delivered: "Delivered",
};

export const ACTIVE_STATUSES = [
  "Pending",
  "WaitingForCustomerApproval",
  "Outsourced",
  "Ready",
  "Return",
] as const;

export type StaffRole = "reception" | "technician" | "admin";

/** Flexible status selection — no strict sequential flow. */
export function getSelectableStatuses(
  current: JobStatusValue,
  role: StaffRole
): JobStatusValue[] {
  if (current === "Delivered") {
    if (role !== "admin") return [];
    return [...ACTIVE_STATUSES];
  }

  if (current === "Outsourced") {
    return role === "admin"
      ? ["Ready", "Return", "Pending", "WaitingForCustomerApproval"]
      : ["Ready", "Return"];
  }

  const options = JOB_STATUSES.filter((s) => s !== current && s !== "Delivered");

  if (role === "technician") {
    return options;
  }

  return options;
}

export function isDeliveredTerminal(status: string): boolean {
  return status === "Delivered";
}
