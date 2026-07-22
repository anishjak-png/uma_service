import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { CACHE_TTL, getCached, setCache } from "@/lib/cache";
import { daysAgo, getPeriodRange, type ReportPeriod } from "@/lib/reports";

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

async function buildSummary(period: ReportPeriod, start: Date, end: Date) {
  const [
    jobsReceived,
    jobsDelivered,
    deliveredInPeriod,
    allJobsInPeriod,
    readyJobs,
    pendingJobs,
  ] = await Promise.all([
    prisma.jobCard.count({
      where: { receivedAt: { gte: start, lt: end } },
    }),
    prisma.jobCard.count({
      where: { status: "Delivered", deliveredAt: { gte: start, lt: end } },
    }),
    prisma.jobCard.findMany({
      where: { status: "Delivered", deliveredAt: { gte: start, lt: end } },
      select: { serviceAmount: true },
    }),
    prisma.jobCard.count({
      where: { receivedAt: { gte: start, lt: end } },
    }),
    prisma.jobCard.findMany({
      where: { status: "Ready" },
      select: { serviceAmount: true },
    }),
    prisma.jobCard.findMany({
      where: { status: "Pending" },
      select: { id: true, receivedAt: true },
    }),
  ]);

  return {
    period,
    summary: {
      jobsReceived,
      jobsDelivered,
      totalJobs: allJobsInPeriod,
      totalCollection: sumAmount(deliveredInPeriod),
    },
    pendingAging: {
      over3Days: pendingJobs.filter((j) => j.receivedAt < daysAgo(3)).length,
      over7Days: pendingJobs.filter((j) => j.receivedAt < daysAgo(7)).length,
      over15Days: pendingJobs.filter((j) => j.receivedAt < daysAgo(15)).length,
    },
    readyNotDelivered: {
      count: readyJobs.length,
      totalAmount: sumAmount(readyJobs),
    },
  };
}

async function buildTechnicianReports(period: ReportPeriod, start: Date, end: Date) {
  const technicians = await prisma.technician.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  const assignedWorkloadReports = await Promise.all(
    technicians.map(async (tech) => {
      const jobs = await prisma.jobCard.findMany({
        where: { assignedTechnicianId: tech.id },
        select: { status: true },
      });
      return {
        name: tech.name,
        totalAssigned: jobs.length,
        pending: jobs.filter((j) => j.status === "Pending").length,
        ready: jobs.filter((j) => j.status === "Ready").length,
        waitingForApproval: jobs.filter(
          (j) => j.status === "WaitingForCustomerApproval"
        ).length,
        return: jobs.filter((j) => j.status === "Return").length,
      };
    })
  );

  const completedByReports = await Promise.all(
    technicians.map(async (tech) => {
      const completedInPeriod = await prisma.jobCard.count({
        where: {
          completedByTechnicianId: tech.id,
          readyAt: { gte: start, lt: end },
        },
      });

      const delivered = await prisma.jobCard.findMany({
        where: {
          completedByTechnicianId: tech.id,
          status: "Delivered",
          deliveredAt: { gte: start, lt: end },
        },
        select: { serviceAmount: true },
      });

      const { lowest, highest } = billRange(delivered);

      return {
        name: tech.name,
        totalCompletedJobs: completedInPeriod,
        totalCollection: sumAmount(delivered),
        averageBill: avgAmount(delivered),
        lowestBill: lowest,
        highestBill: highest,
      };
    })
  );

  return { period, assignedWorkloadReports, completedByReports };
}

async function buildBrandApplianceReports(period: ReportPeriod, start: Date, end: Date) {
  const jobsInPeriod = await prisma.jobCard.findMany({
    where: { receivedAt: { gte: start, lt: end } },
    select: { serviceAmount: true, status: true, applianceType: true, brand: true },
  });

  const applianceTypes = [...new Set(jobsInPeriod.map((j) => j.applianceType))].sort();
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

  const period = (request.nextUrl.searchParams.get("period") ?? "today") as ReportPeriod;
  const section = (request.nextUrl.searchParams.get("section") ??
    "summary") as ReportSection;
  const { start, end } = getPeriodRange(period);

  const cacheKey = `reports:${section}:${period}`;
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
