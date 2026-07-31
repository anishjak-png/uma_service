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

export async function getReceptionDashboardData() {
  const { today, tomorrow } = todayRange();

  const [todayJobs, statusGroups, readyForPickup] = await Promise.all([
    prisma.jobCard.count({
      where: { receivedAt: { gte: today, lt: tomorrow } },
    }),
    prisma.jobCard.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.jobCard.findMany({
      where: { status: "Ready" },
      select: {
        id: true,
        jobNumber: true,
        brand: true,
        applianceType: true,
        readyAt: true,
        serviceAmount: true,
        customer: { select: { name: true, mobile: true } },
      },
      orderBy: { readyAt: "desc" },
      take: 20,
    }),
  ]);

  const counts = countsFromGroups(statusGroups);

  return {
    todayJobs,
    ...counts,
    readyForPickup,
  };
}

export async function getAdminDashboardData() {
  const { today, tomorrow } = todayRange();
  const { monthStart, nextMonth } = monthRange();

  const [todayJobs, statusGroups, todayCollection, monthlyCollection, readyCollection, readyForPickup] =
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
        select: {
          id: true,
          jobNumber: true,
          brand: true,
          applianceType: true,
          readyAt: true,
          serviceAmount: true,
          customer: { select: { name: true, mobile: true } },
        },
        orderBy: { readyAt: "desc" },
        take: 20,
      }),
    ]);

  const counts = countsFromGroups(statusGroups);

  return {
    todayJobs,
    ...counts,
    todayCollection: todayCollection._sum.serviceAmount ?? 0,
    monthlyCollection: monthlyCollection._sum.serviceAmount ?? 0,
    pendingCollection: readyCollection._sum.serviceAmount ?? 0,
    readyForPickup,
  };
}
