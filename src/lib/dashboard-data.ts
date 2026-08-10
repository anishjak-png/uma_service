import { prisma } from "@/lib/db";

function todayRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today, tomorrow };
}

function monthRange() {
  const { today } = todayRange();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return { monthStart, nextMonth };
}

function countsFromGroups(groups: Array<{ status: string; _count: { id: number } }>) {
  const map = Object.fromEntries(groups.map((g) => [g.status, g._count.id]));
  return {
    pendingJobs: map.Pending ?? 0,
    readyJobs: map.Ready ?? 0,
    deliveredJobs: map.Delivered ?? 0,
    waitingApprovalJobs: map.WaitingForCustomerApproval ?? 0,
    returnJobs: map.Return ?? 0,
    outsourcedJobs: map.Outsourced ?? 0,
    warrantyJobs:
      (map.WarrantyPending ?? 0) + (map.WarrantyWithCompany ?? 0),
  };
}

const readyPickupSelect = {
  id: true,
  jobNumber: true,
  brand: true,
  applianceType: true,
  readyAt: true,
  serviceAmount: true,
  deliveryContactStatus: true,
  expectedDeliveryAt: true,
  customer: { select: { name: true, mobile: true } },
  completedByTechnician: { select: { name: true } },
  completedByOutsource: { select: { name: true } },
} as const;

function jobNumberSortKey(jobNumber: string): number {
  const n = Number.parseInt(jobNumber.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/** Oldest UT number first (numeric). */
function sortReadyForPickup<T extends { jobNumber: string }>(jobs: T[]): T[] {
  return [...jobs].sort(
    (a, b) => jobNumberSortKey(a.jobNumber) - jobNumberSortKey(b.jobNumber)
  );
}

export async function getReceptionDashboardData() {
  const { today, tomorrow } = todayRange();

  const [todayJobs, statusGroups, readyRows] = await Promise.all([
    prisma.jobCard.count({
      where: { receivedAt: { gte: today, lt: tomorrow } },
    }),
    prisma.jobCard.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.jobCard.findMany({
      where: { status: "Ready" },
      select: readyPickupSelect,
    }),
  ]);

  const counts = countsFromGroups(statusGroups);

  return {
    todayJobs,
    ...counts,
    readyForPickup: sortReadyForPickup(readyRows).map((j) => ({
      ...j,
      readyAt: j.readyAt?.toISOString() ?? null,
      expectedDeliveryAt: j.expectedDeliveryAt?.toISOString() ?? null,
    })),
  };
}

export async function getAdminDashboardData() {
  const { today, tomorrow } = todayRange();
  const { monthStart, nextMonth } = monthRange();

  const [todayJobs, statusGroups, todayCollection, monthlyCollection, readyCollection, readyRows] =
    await Promise.all([
      prisma.jobCard.count({
        where: { receivedAt: { gte: today, lt: tomorrow } },
      }),
      prisma.jobCard.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.jobCard.aggregate({
        where: { status: "Delivered", deliveredAt: { gte: today, lt: tomorrow } },
        _sum: { serviceAmount: true },
      }),
      prisma.jobCard.aggregate({
        where: {
          status: "Delivered",
          deliveredAt: { gte: monthStart, lt: nextMonth },
        },
        _sum: { serviceAmount: true },
      }),
      prisma.jobCard.aggregate({
        where: { status: "Ready" },
        _sum: { serviceAmount: true },
      }),
      prisma.jobCard.findMany({
        where: { status: "Ready" },
        select: readyPickupSelect,
      }),
    ]);

  const counts = countsFromGroups(statusGroups);

  return {
    todayJobs,
    ...counts,
    todayCollection: todayCollection._sum.serviceAmount ?? 0,
    monthlyCollection: monthlyCollection._sum.serviceAmount ?? 0,
    pendingCollection: readyCollection._sum.serviceAmount ?? 0,
    readyForPickup: sortReadyForPickup(readyRows).map((j) => ({
      ...j,
      readyAt: j.readyAt?.toISOString() ?? null,
      expectedDeliveryAt: j.expectedDeliveryAt?.toISOString() ?? null,
    })),
  };
}
