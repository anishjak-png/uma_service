import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { daysAgo, getPeriodRange, type ReportPeriod } from "@/lib/reports";

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

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const period = (request.nextUrl.searchParams.get("period") ?? "today") as ReportPeriod;
  const { start, end } = getPeriodRange(period);

  const [
    jobsReceived,
    jobsDelivered,
    deliveredInPeriod,
    allJobsInPeriod,
    technicians,
    readyJobs,
    pendingJobs,
  ] = await Promise.all([
    prisma.jobCard.count({
      where: { receivedAt: { gte: start, lt: end } },
    }),
    prisma.jobCard.count({
      where: {
        status: "Delivered",
        deliveredAt: { gte: start, lt: end },
      },
    }),
    prisma.jobCard.findMany({
      where: {
        status: "Delivered",
        deliveredAt: { gte: start, lt: end },
      },
      select: { serviceAmount: true },
    }),
    prisma.jobCard.findMany({
      where: { receivedAt: { gte: start, lt: end } },
      select: {
        id: true,
        status: true,
        serviceAmount: true,
        applianceType: true,
        brand: true,
        assignedTechnicianId: true,
        receivedAt: true,
      },
    }),
    prisma.technician.findMany({
      where: { active: true },
      select: { id: true, name: true },
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

  const totalCollection = sumAmount(deliveredInPeriod);

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
      const completedInPeriod = await prisma.jobCard.findMany({
        where: {
          completedByTechnicianId: tech.id,
          readyAt: { gte: start, lt: end },
        },
        select: { id: true },
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
        totalCompletedJobs: completedInPeriod.length,
        totalCollection: sumAmount(delivered),
        averageBill: avgAmount(delivered),
        lowestBill: lowest,
        highestBill: highest,
      };
    })
  );

  const applianceTypes = [
    ...new Set(allJobsInPeriod.map((j) => j.applianceType)),
  ].sort();

  const applianceReports = await Promise.all(
    applianceTypes.map(async (applianceType) => {
      const jobs = await prisma.jobCard.findMany({
        where: {
          applianceType,
          receivedAt: { gte: start, lt: end },
        },
        select: { serviceAmount: true, status: true },
      });
      const billable = jobs.filter(
        (j) => j.serviceAmount != null && j.status !== "Pending"
      );
      return {
        applianceType,
        totalJobs: jobs.length,
        totalCollection: sumAmount(
          jobs.filter((j) => j.status === "Delivered")
        ),
        averageServiceAmount: avgAmount(billable),
      };
    })
  );

  const brands = [...new Set(allJobsInPeriod.map((j) => j.brand))].sort();

  const brandReports = await Promise.all(
    brands.map(async (brand) => {
      const jobs = await prisma.jobCard.findMany({
        where: {
          brand,
          receivedAt: { gte: start, lt: end },
        },
        select: { serviceAmount: true, status: true },
      });
      return {
        brand,
        totalJobs: jobs.length,
        totalCollection: sumAmount(
          jobs.filter((j) => j.status === "Delivered")
        ),
      };
    })
  );

  const pendingAging = {
    over3Days: pendingJobs.filter((j) => j.receivedAt < daysAgo(3)).length,
    over7Days: pendingJobs.filter((j) => j.receivedAt < daysAgo(7)).length,
    over15Days: pendingJobs.filter((j) => j.receivedAt < daysAgo(15)).length,
  };

  return NextResponse.json({
    period,
    summary: {
      jobsReceived,
      jobsDelivered,
      totalJobs: allJobsInPeriod.length,
      totalCollection,
    },
    assignedWorkloadReports,
    completedByReports,
    applianceReports,
    brandReports,
    pendingAging,
    readyNotDelivered: {
      count: readyJobs.length,
      totalAmount: sumAmount(readyJobs),
    },
    pendingCollection: {
      count: pendingJobs.length,
      totalAmount: 0,
    },
  });
}
