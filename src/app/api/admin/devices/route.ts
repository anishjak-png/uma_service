import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = request.nextUrl.searchParams.get("status");

  const devices = await prisma.staffDevice.findMany({
    where:
      status === "pending" ||
      status === "approved" ||
      status === "revoked"
        ? { status }
        : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      staffUser: {
        select: { id: true, name: true, mobile: true, role: true },
      },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  const pendingCount = await prisma.staffDevice.count({
    where: { status: "pending" },
  });

  return NextResponse.json({
    pendingCount,
    devices: devices.map((d) => ({
      id: d.id,
      deviceId: d.deviceId,
      deviceLabel: d.deviceLabel,
      platform: d.platform,
      status: d.status,
      lastSeenAt: d.lastSeenAt,
      createdAt: d.createdAt,
      approvedAt: d.approvedAt,
      staffUser: d.staffUser,
      approvedByName: d.approvedBy?.name ?? null,
    })),
  });
}
