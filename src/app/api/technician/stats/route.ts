import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session.isLoggedIn || session.role !== "technician" || !session.technicianId) {
    return NextResponse.json({ error: "Technician only" }, { status: 403 });
  }

  const technicianId = session.technicianId;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  const assigned = { assignedTechnicianId: technicianId };
  const completedBy = { completedByTechnicianId: technicianId };

  const [pendingJobs, readyJobs, deliveredThisMonth] = await Promise.all([
    prisma.jobCard.count({
      where: { ...assigned, status: "Pending" },
    }),
    prisma.jobCard.count({
      where: { ...assigned, status: "Ready" },
    }),
    prisma.jobCard.count({
      where: {
        ...completedBy,
        status: "Delivered",
        deliveredAt: { gte: monthStart, lt: nextMonth },
      },
    }),
  ]);

  return NextResponse.json({
    pendingJobs,
    readyJobs,
    deliveredThisMonth,
  });
}
