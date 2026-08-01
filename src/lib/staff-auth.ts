import { prisma } from "@/lib/db";
import type { DeviceStatus, StaffRole } from "@prisma/client";

export async function countApprovedDevices(): Promise<number> {
  return prisma.staffDevice.count({ where: { status: "approved" } });
}

export async function countPendingDevices(): Promise<number> {
  return prisma.staffDevice.count({ where: { status: "pending" } });
}

/** Non-admin users may only have one approved device at a time. */
export async function revokeOtherApprovedDevices(
  staffUserId: string,
  exceptDeviceId: string
): Promise<number> {
  const result = await prisma.staffDevice.updateMany({
    where: {
      staffUserId,
      deviceId: { not: exceptDeviceId },
      status: "approved",
    },
    data: {
      status: "revoked",
      approvedAt: null,
      approvedById: null,
    },
  });
  return result.count;
}

export async function getStaffDevice(
  staffUserId: string,
  deviceId: string
) {
  return prisma.staffDevice.findUnique({
    where: { staffUserId_deviceId: { staffUserId, deviceId } },
  });
}

export async function upsertStaffDevice(params: {
  staffUserId: string;
  deviceId: string;
  deviceLabel?: string | null;
  platform: "android" | "web";
  autoApprove?: boolean;
  approvedById?: string;
}) {
  const existing = await getStaffDevice(params.staffUserId, params.deviceId);

  if (existing) {
    return prisma.staffDevice.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: new Date(),
        deviceLabel: params.deviceLabel ?? existing.deviceLabel,
        ...(params.autoApprove
          ? {
              status: "approved" as DeviceStatus,
              approvedAt: new Date(),
              approvedById: params.approvedById ?? null,
            }
          : {}),
      },
    });
  }

  return prisma.staffDevice.create({
    data: {
      staffUserId: params.staffUserId,
      deviceId: params.deviceId,
      deviceLabel: params.deviceLabel ?? null,
      platform: params.platform,
      status: params.autoApprove ? "approved" : "pending",
      approvedAt: params.autoApprove ? new Date() : null,
      approvedById: params.autoApprove ? (params.approvedById ?? null) : null,
    },
  });
}

export function staffRoleToSessionRole(role: StaffRole) {
  return role as "reception" | "technician" | "admin";
}
