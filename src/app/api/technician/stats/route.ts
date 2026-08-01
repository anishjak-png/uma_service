import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session.isLoggedIn || session.role !== "technician" || !session.technicianId) {
    return NextResponse.json({ error: "Technician only" }, { status: 403 });
  }

  const assigned = { assignedTechnicianId: session.technicianId };

  const [
    receivedTotal,
    pendingJobs,
    waitingApprovalJobs,
    readyJobs,
    returnJobs,
    deliveredJobs,
  ] = await Promise.all([
    prisma.jobCard.count({ where: assigned }),
    prisma.jobCard.count({ where: { ...assigned, status: "Pending" } }),
    prisma.jobCard.count({
      where: { ...assigned, status: "WaitingForCustomerApproval" },
    }),
    prisma.jobCard.count({ where: { ...assigned, status: "Ready" } }),
    prisma.jobCard.count({ where: { ...assigned, status: "Return" } }),
    prisma.jobCard.count({ where: { ...assigned, status: "Delivered" } }),
  ]);

  const pending = pendingJobs + waitingApprovalJobs;
  const attended = readyJobs + returnJobs;

  return NextResponse.json({
    receivedTotal,
    pending,
    pendingJobs,
    waitingApprovalJobs,
    attended,
    readyJobs,
    returnJobs,
    delivered: deliveredJobs,
  });
}
