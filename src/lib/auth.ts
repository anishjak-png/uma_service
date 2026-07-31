import { getSession, isDeviceApproved } from "./session";
import type { StaffRole } from "./session";

export async function requireAdmin() {
  const session = await getSession();
  if (
    !session.isLoggedIn ||
    session.role !== "admin" ||
    !isDeviceApproved(session)
  ) {
    return null;
  }
  return session;
}

export async function requireStaff(allowed: StaffRole[]) {
  const session = await getSession();
  if (
    !session.isLoggedIn ||
    !allowed.includes(session.role) ||
    !isDeviceApproved(session)
  ) {
    return null;
  }
  return session;
}

export async function requireApprovedDevice() {
  const session = await getSession();
  if (!session.isLoggedIn || !isDeviceApproved(session)) {
    return null;
  }
  return session;
}

export function canCreateJob(role: StaffRole) {
  return role === "reception" || role === "admin";
}

export function canDeliverJob(role: StaffRole) {
  return role === "reception" || role === "admin";
}

export function canEditDeliveredJob(role: StaffRole) {
  return role === "admin";
}

export function canReopenDeliveredJob(role: StaffRole) {
  return role === "admin";
}

export function canEditServiceAmount(role: StaffRole) {
  return role === "admin";
}

export function canEditCompletedBy(role: StaffRole) {
  return role === "admin";
}

/** Amount is locked once the job has been marked Ready at least once. */
export function isServiceAmountLocked(job: { readyAt: Date | null }) {
  return job.readyAt != null;
}
