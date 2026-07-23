export const APP_NAME = "UMA SERVICE";
export const SHOP_NAME = process.env.NEXT_PUBLIC_SHOP_NAME ?? "Uma Traders";
export const SHOP_PHONE = process.env.NEXT_PUBLIC_SHOP_PHONE ?? "";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const MAX_PRODUCT_PHOTOS = 3;

export const JOB_STATUSES = [
  "Pending",
  "WaitingForCustomerApproval",
  "Ready",
  "Return",
  "Delivered",
] as const;

export type JobStatusValue = (typeof JOB_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  Pending: "Pending",
  WaitingForCustomerApproval: "Waiting for Customer Approval",
  Ready: "Ready",
  Return: "Return",
  Delivered: "Delivered",
};

export const ACTIVE_STATUSES = [
  "Pending",
  "WaitingForCustomerApproval",
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

  const options = JOB_STATUSES.filter((s) => s !== current);

  if (role === "technician") {
    return options.filter((s) => s !== "Delivered");
  }

  return options;
}

export function isDeliveredTerminal(status: string): boolean {
  return status === "Delivered";
}
