import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revokeOtherApprovedDevices } from "@/lib/staff-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireAdmin();
  if (!session || !session.staffUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const action = body.action;

  if (action !== "approve" && action !== "revoke") {
    return NextResponse.json(
      { error: "Action must be approve or revoke" },
      { status: 400 }
    );
  }

  const device = await prisma.staffDevice.findUnique({
    where: { id },
    include: {
      staffUser: { select: { id: true, name: true, mobile: true, role: true } },
    },
  });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const updated = await prisma.staffDevice.update({
    where: { id },
    data:
      action === "approve"
        ? {
            status: "approved",
            approvedAt: new Date(),
            approvedById: session.staffUserId,
          }
        : {
            status: "revoked",
            approvedAt: null,
            approvedById: session.staffUserId,
          },
    include: {
      staffUser: {
        select: { id: true, name: true, mobile: true, role: true },
      },
    },
  });

  if (
    action === "approve" &&
    updated.staffUser.role !== "admin"
  ) {
    await revokeOtherApprovedDevices(updated.staffUserId, updated.deviceId);
  }

  return NextResponse.json({
    device: {
      id: updated.id,
      status: updated.status,
      approvedAt: updated.approvedAt,
      staffUser: updated.staffUser,
    },
  });
}
