import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { CACHE_TTL, getCached, setCache } from "@/lib/cache";
import {
  daysAgo,
  getPeriodRange,
  isReportPeriod,
  wasDeliveredFromReturn,
  type ReportPeriod,
} from "@/lib/reports";

type ReportSection = "summary" | "technicians" | "brands-appliances";

function sumAmount(jobs: { serviceAmount: number | null }[]) {
  return jobs.reduce((total, job) => total + (job.serviceAmount ?? 0), 0);
}

function avgAmount(jobs: { serviceAmount: number | null }[]) {
  const withAmount = jobs.filter((j) => j.serviceAmount != null);
  if (withAmount.length === 0) return 0;
  return sumAmount(withAmount) / withAmount.length;
}

function billRange(jobs: { serviceAmount: number | null }[]) {
  const amounts = jobs
    .map((j) => j.serviceAmount)
    .filter((a): a is number => a != null);
  if (amounts.length === 0) return { lowest: 0, highest: 0 };
  return { lowest: Math.min(...amounts), highest: Math.max(...amounts) };
}

function countStatus(jobs: { status: string }[], status: string) {
  return jobs.filter((j) => j.status === status).length;
}

function agingBuckets(dates: Date[]) {
  const d3 = daysAgo(3);
  const d7 = daysAgo(7);
  const d15 = daysAgo(15);
  return {
    over3Days: dates.filter((d) => d < d3).length,
    over7Days: dates.filter((d) => d < d7).length,
    over15Days: dates.filter((d) => d < d15).length,
  };
}

async function buildSummary(period: ReportPeriod, start: Date, end: Date) {
  const [cohortJobs, readyLiveJobs, returnLiveJobs, pendingLiveJobs, liveCounts] =
    await Promise.all([
      prisma.jobCard.findMany({
        where: { receivedAt: { gte: start, lt: end } },
        select: {
          status: true,
          serviceAmount: true,
          statusHistory: {
            orderBy: [{ changedAt: "desc" }, { id: "desc" }],
            take: 8,
            select: { status: true },
          },
        },
      }),
      prisma.jobCard.findMany({
        where: { status: "Ready" },
        select: { serviceAmount: true, readyAt: true, receivedAt: true },
      }),
      prisma.jobCard.findMany({
        where: { status: "Return" },
        select: { receivedAt: true },
      }),
      prisma.jobCard.findMany({
        where: { status: "Pending" },
        select: { receivedAt: true },
      }),
      prisma.jobCard.groupBy({
        by: ["status"],
        _count: { id: true },
        where: {
          status: {
            in: [
              "Pending",
              "Ready",
              "Return",
              "Outsourced",
              "WarrantyPending",
              "WarrantyWithCompany",
            ],
          },
        },
      }),
    ]);

  const liveByStatus = Object.fromEntries(
    liveCounts.map((row) => [row.status, row._count.id])
  ) as Record<string, number>;

  const jobsCreated = cohortJobs.length;
  const deliveredJobs = cohortJobs.filter((j) => j.status === "Delivered");
  const delivered = deliveredJobs.length;
  const jobsReturned = deliveredJobs.filter((j) =>
    wasDeliveredFromReturn(j.statusHistory)
  ).length;
  const totalCollection = sumAmount(deliveredJobs);

  const undeliveredReady = countStatus(cohortJobs, "Ready");
  const undeliveredReturn = countStatus(cohortJobs, "Return");
  const undelivered = undeliveredReady + undeliveredReturn;

  const cohortPending = countStatus(cohortJobs, "Pending");
  const cohortWaiting = countStatus(cohortJobs, "WaitingForCustomerApproval");
  const cohortOutsourced = countStatus(cohortJobs, "Outsourced");
  const cohortWarranty =
    countStatus(cohortJobs, "WarrantyPending") +
    countStatus(cohortJobs, "WarrantyWithCompany");
  const pendingOpen =
    cohortPending + cohortWaiting + cohortOutsourced + cohortWarranty;

  const warrantyLive =
    (liveByStatus.WarrantyPending ?? 0) +
    (liveByStatus.WarrantyWithCompany ?? 0);

  const undeliveredAgeDates = [
    ...readyLiveJobs.map((j) => j.readyAt ?? j.receivedAt),
    ...returnLiveJobs.map((j) => j.receivedAt),
  ];

  return {
    period,
    summary: {
      jobsCreated,
      jobsReceived: jobsCreated,
      totalJobs: jobsCreated,
      delivered,
      undelivered,
      undeliveredReady,
      undeliveredReturn,
      pendingOpen,
      pendingOpenPending: cohortPending,
      pendingOpenWaiting: cohortWaiting,
      pendingOpenOutsourced: cohortOutsourced,
      pendingOpenWarranty: cohortWarranty,
      totalCollection,
      jobsReturned,
      jobsDeliveredReady: delivered - jobsReturned,
      jobsDeliveredReturn: jobsReturned,
      pendingLive: liveByStatus.Pending ?? 0,
      returnLive: liveByStatus.Return ?? 0,
      outsourcedLive: liveByStatus.Outsourced ?? 0,
      warrantyLive,
      readyLive: readyLiveJobs.length,
      readyLiveAmount: sumAmount(readyLiveJobs),
    },
    pendingAging: agingBuckets(pendingLiveJobs.map((j) => j.receivedAt)),
    undeliveredAging: agingBuckets(undeliveredAgeDates),
    readyNotDelivered: {
      count: readyLiveJobs.length,
      totalAmount: sumAmount(readyLiveJobs),
    },
  };
}

async function buildTechnicianReports(period: ReportPeriod, start: Date, end: Date) {
  const technicians = await prisma.technician.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [receivedInPeriod, assignedByStatus, completedInPeriod, deliveredInPeriod] =
    await Promise.all([
      prisma.jobCard.groupBy({
        by: ["assignedTechnicianId"],
        _count: { id: true },
        where: {
          assignedTechnicianId: { not: null },
          receivedAt: { gte: start, lt: end },
        },
      }),
      prisma.jobCard.groupBy({
        by: ["assignedTechnicianId", "status"],
        _count: { id: true },
        where: { assignedTechnicianId: { not: null } },
      }),
      prisma.jobCard.groupBy({
        by: ["completedByTechnicianId"],
        _count: { id: true },
        where: {
          completedByTechnicianId: { not: null },
          readyAt: { gte: start, lt: end },
        },
      }),
      prisma.jobCard.findMany({
        where: {
          completedByTechnicianId: { not: null },
          status: "Delivered",
          deliveredAt: { gte: start, lt: end },
        },
        select: { completedByTechnicianId: true, serviceAmount: true },
      }),
    ]);

  const receivedById = Object.fromEntries(
    receivedInPeriod.map((row) => [row.assignedTechnicianId!, row._count.id])
  );

  const completedById = Object.fromEntries(
    completedInPeriod.map((row) => [row.completedByTechnicianId!, row._count.id])
  );

  const deliveredByTech = new Map<string, { serviceAmount: number | null }[]>();
  for (const job of deliveredInPeriod) {
    const techId = job.completedByTechnicianId!;
    const list = deliveredByTech.get(techId) ?? [];
    list.push({ serviceAmount: job.serviceAmount });
    deliveredByTech.set(techId, list);
  }

  const technicianReports = technicians
    .map((tech) => {
      const statusRows = assignedByStatus.filter(
        (row) => row.assignedTechnicianId === tech.id
      );
      const countAssigned = (status: string) =>
        statusRows.find((row) => row.status === status)?._count.id ?? 0;

      const pending = countAssigned("Pending");
      const waitingForApproval = countAssigned("WaitingForCustomerApproval");
      const ready = countAssigned("Ready");
      const returnCount = countAssigned("Return");
      const activePipeline = pending + waitingForApproval + ready + returnCount;
      const received = receivedById[tech.id] ?? 0;
      const completed = completedById[tech.id] ?? 0;
      const deliveredJobs = deliveredByTech.get(tech.id) ?? [];
      const delivered = deliveredJobs.length;
      const totalCollection = sumAmount(deliveredJobs);
      const { lowest, highest } = billRange(deliveredJobs);

      return {
        id: tech.id,
        name: tech.name,
        // Live backlog (currently assigned)
        pending,
        waitingForApproval,
        ready,
        return: returnCount,
        activePipeline,
        // Period performance
        received,
        completed,
        delivered,
        totalCollection,
        averageBill: avgAmount(deliveredJobs),
        lowestBill: lowest,
        highestBill: highest,
      };
    })
    .sort((a, b) => {
      if (b.totalCollection !== a.totalCollection) {
        return b.totalCollection - a.totalCollection;
      }
      return b.activePipeline - a.activePipeline;
    });

  const totals = technicianReports.reduce(
    (acc, row) => ({
      received: acc.received + row.received,
      pending: acc.pending + row.pending,
      waitingForApproval: acc.waitingForApproval + row.waitingForApproval,
      ready: acc.ready + row.ready,
      return: acc.return + row.return,
      activePipeline: acc.activePipeline + row.activePipeline,
      completed: acc.completed + row.completed,
      delivered: acc.delivered + row.delivered,
      totalCollection: acc.totalCollection + row.totalCollection,
    }),
    {
      received: 0,
      pending: 0,
      waitingForApproval: 0,
      ready: 0,
      return: 0,
      activePipeline: 0,
      completed: 0,
      delivered: 0,
      totalCollection: 0,
    }
  );

  return { period, technicianReports, totals };
}

async function buildBrandApplianceReports(
  period: ReportPeriod,
  start: Date,
  end: Date
) {
  const jobsInPeriod = await prisma.jobCard.findMany({
    where: { receivedAt: { gte: start, lt: end } },
    select: {
      serviceAmount: true,
      status: true,
      applianceType: true,
      brand: true,
    },
  });

  const applianceTypes = [
    ...new Set(jobsInPeriod.map((j) => j.applianceType)),
  ].sort();
  const brands = [...new Set(jobsInPeriod.map((j) => j.brand))].sort();

  const applianceReports = applianceTypes.map((applianceType) => {
    const jobs = jobsInPeriod.filter((j) => j.applianceType === applianceType);
    const billable = jobs.filter(
      (j) => j.serviceAmount != null && j.status !== "Pending"
    );
    return {
      applianceType,
      totalJobs: jobs.length,
      totalCollection: sumAmount(jobs.filter((j) => j.status === "Delivered")),
      averageServiceAmount: avgAmount(billable),
    };
  });

  const brandReports = brands.map((brand) => {
    const jobs = jobsInPeriod.filter((j) => j.brand === brand);
    return {
      brand,
      totalJobs: jobs.length,
      totalCollection: sumAmount(jobs.filter((j) => j.status === "Delivered")),
    };
  });

  return { period, applianceReports, brandReports };
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const periodRaw = request.nextUrl.searchParams.get("period") ?? "today";
  const period: ReportPeriod = isReportPeriod(periodRaw) ? periodRaw : "today";
  const section = (request.nextUrl.searchParams.get("section") ??
    "summary") as ReportSection;
  const { start, end } = getPeriodRange(period);

  const cacheKey = `reports:v5:${section}:${period}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  let data: unknown;

  if (section === "technicians") {
    data = await buildTechnicianReports(period, start, end);
  } else if (section === "brands-appliances") {
    data = await buildBrandApplianceReports(period, start, end);
  } else {
    data = await buildSummary(period, start, end);
  }

  const ttl =
    period === "today" ? CACHE_TTL.todayCollection : CACHE_TTL.reports;
  setCache(cacheKey, data, ttl);

  return NextResponse.json(data);
}
