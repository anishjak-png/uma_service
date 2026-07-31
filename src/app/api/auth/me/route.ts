import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { countPendingDevices } from "@/lib/staff-auth";
import { clearSession, getSession, isDeviceApproved } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.staffUserId) {
    return NextResponse.json({ isLoggedIn: false });
  }

  const staffUser = await prisma.staffUser.findUnique({
    where: { id: session.staffUserId },
    include: { technician: true },
  });

  if (!staffUser || !staffUser.active) {
    await clearSession(session);
    return NextResponse.json({ isLoggedIn: false });
  }

  if (session.deviceId) {
    const device = await prisma.staffDevice.findUnique({
      where: {
        staffUserId_deviceId: {
          staffUserId: session.staffUserId,
          deviceId: session.deviceId,
        },
      },
    });

    if (!device || device.status === "revoked") {
      await clearSession(session);
      return NextResponse.json({
        isLoggedIn: false,
        error: "device_revoked",
      });
    }

    session.deviceStatus = device.status;
    if (device.status === "approved") {
      await prisma.staffDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      });
    }
    await session.save();
  }

  const payload: Record<string, unknown> = {
    isLoggedIn: true,
    role: session.role,
    staffName: staffUser.name,
    staffUserId: staffUser.id,
    deviceStatus: session.deviceStatus ?? "pending",
    deviceApproved: isDeviceApproved(session),
    technicianId: session.technicianId ?? staffUser.technicianId,
    technicianName:
      session.technicianName ?? staffUser.technician?.name ?? null,
  };

  if (session.role === "admin" && isDeviceApproved(session)) {
    payload.pendingDeviceCount = await countPendingDevices();
  }

  return NextResponse.json(payload);
}
