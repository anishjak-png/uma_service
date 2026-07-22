import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { prisma } from "@/lib/db";

async function getDashboardData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const activeStatuses = ["Pending", "WaitingForCustomerApproval", "Ready", "Return"] as const;

  const [
    todayJobs,
    pendingJobs,
    readyJobs,
    deliveredJobs,
    waitingApprovalJobs,
    todayDeliveries,
    todayCollection,
    monthlyCollection,
    readyCollection,
    monthlyJobs,
    recentReady,
    brandWise,
    applianceWise,
    technicianGroups,
    completedByGroups,
  ] = await Promise.all([
    prisma.jobCard.count({ where: { receivedAt: { gte: today, lt: tomorrow } } }),
    prisma.jobCard.count({ where: { status: "Pending" } }),
    prisma.jobCard.count({ where: { status: "Ready" } }),
    prisma.jobCard.count({ where: { status: "Delivered" } }),
    prisma.jobCard.count({ where: { status: "WaitingForCustomerApproval" } }),
    prisma.jobCard.count({
      where: { status: "Delivered", deliveredAt: { gte: today, lt: tomorrow } },
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
    prisma.jobCard.count({
      where: { receivedAt: { gte: monthStart, lt: nextMonth } },
    }),
    prisma.jobCard.findMany({
      where: { status: "Ready" },
      include: { customer: true },
      orderBy: { readyAt: "desc" },
      take: 6,
    }),
    prisma.jobCard.groupBy({
      by: ["brand"],
      _count: { id: true },
      where: { status: { in: [...activeStatuses] } },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    }),
    prisma.jobCard.groupBy({
      by: ["applianceType"],
      _count: { id: true },
      where: { status: { in: [...activeStatuses] } },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    }),
    prisma.jobCard.groupBy({
      by: ["assignedTechnicianId"],
      _count: { id: true },
      where: { status: { in: [...activeStatuses] } },
    }),
    prisma.jobCard.groupBy({
      by: ["completedByTechnicianId"],
      _count: { id: true },
      _sum: { serviceAmount: true },
      where: {
        status: "Delivered",
        deliveredAt: { gte: monthStart, lt: nextMonth },
        completedByTechnicianId: { not: null },
      },
    }),
  ]);

  const technicianIds = technicianGroups
    .map((g) => g.assignedTechnicianId)
    .filter((id): id is string => id != null);

  const technicians = technicianIds.length
    ? await prisma.technician.findMany({
        where: { id: { in: technicianIds } },
        select: { id: true, name: true },
      })
    : [];

  const techNames = Object.fromEntries(technicians.map((t) => [t.id, t.name]));

  const completedByIds = completedByGroups
    .map((g) => g.completedByTechnicianId)
    .filter((id): id is string => id != null);

  const completedByTechnicians = completedByIds.length
    ? await prisma.technician.findMany({
        where: { id: { in: completedByIds } },
        select: { id: true, name: true },
      })
    : [];

  const completedByNames = Object.fromEntries(
    completedByTechnicians.map((t) => [t.id, t.name])
  );

  return {
    counts: {
      todayJobs,
      pendingJobs,
      readyJobs,
      deliveredJobs,
      waitingApprovalJobs,
      todayDeliveries,
      todayCollection: todayCollection._sum.serviceAmount ?? 0,
      monthlyCollection: monthlyCollection._sum.serviceAmount ?? 0,
      readyForDelivery: readyJobs,
      pendingCollection: readyCollection._sum.serviceAmount ?? 0,
      monthlyJobs,
    },
    recentReady,
    brandWise,
    applianceWise,
    technicianWise: technicianGroups.map((g) => ({
      name: g.assignedTechnicianId
        ? (techNames[g.assignedTechnicianId] ?? "Unknown")
        : "Unassigned",
      count: g._count.id,
    })),
    completedByWise: completedByGroups.map((g) => ({
      name: g.completedByTechnicianId
        ? (completedByNames[g.completedByTechnicianId] ?? "Unknown")
        : "Unknown",
      completedJobs: g._count.id,
      totalCollection: g._sum.serviceAmount ?? 0,
    })),
  };
}

export default async function DashboardPage() {
  const { counts, recentReady, brandWise, applianceWise, technicianWise, completedByWise } =
    await getDashboardData();

  return (
    <AppShell>
      <PageHeader title="Dashboard" description="Service overview" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Today's Jobs" value={counts.todayJobs} />
        <StatCard
          label="Pending Jobs"
          value={counts.pendingJobs}
          href="/jobs/search?status=Pending"
          valueClassName="text-blue-700"
        />
        <StatCard
          label="Ready Jobs"
          value={counts.readyJobs}
          href="/jobs/search?status=Ready"
          valueClassName="text-emerald-700"
        />
        <StatCard
          label="Delivered Jobs"
          value={counts.deliveredJobs}
          href="/jobs/search?status=Delivered"
        />
        <StatCard
          label="Waiting for Customer Approval"
          value={counts.waitingApprovalJobs}
          href="/jobs/search?status=WaitingForCustomerApproval"
          valueClassName="text-amber-700"
        />
        <StatCard
          label="Today's Collection"
          value={formatCurrency(counts.todayCollection)}
          valueClassName="text-emerald-800"
        />
        <StatCard
          label="Monthly Collection"
          value={formatCurrency(counts.monthlyCollection)}
          valueClassName="text-emerald-800"
        />
        <StatCard
          label="Ready for Delivery"
          value={counts.readyForDelivery}
          href="/jobs/search?status=Ready"
        />
        <StatCard
          label="Pending Collection"
          value={formatCurrency(counts.pendingCollection)}
          subtext="Ready jobs not yet delivered"
          valueClassName="text-amber-800"
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigned Workload (Active Jobs)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {technicianWise.length === 0 ? (
              <p className="text-slate-500">No active jobs</p>
            ) : (
              technicianWise.map((row) => (
                <div key={row.name} className="flex justify-between">
                  <span className="text-slate-700">{row.name}</span>
                  <span className="font-semibold text-slate-900">{row.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Completed By (This Month)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {completedByWise.length === 0 ? (
              <p className="text-slate-500">No completed jobs this month</p>
            ) : (
              completedByWise.map((row) => (
                <div key={row.name} className="flex justify-between gap-2">
                  <span className="text-slate-700">{row.name}</span>
                  <span className="text-right text-slate-900">
                    {row.completedJobs} jobs · {formatCurrency(row.totalCollection)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand-wise Jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {brandWise.length === 0 ? (
              <p className="text-slate-500">No active jobs</p>
            ) : (
              brandWise.map((row) => (
                <div key={row.brand} className="flex justify-between">
                  <span className="text-slate-700">{row.brand}</span>
                  <span className="font-semibold text-slate-900">{row._count.id}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appliance-wise Jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {applianceWise.length === 0 ? (
              <p className="text-slate-500">No active jobs</p>
            ) : (
              applianceWise.map((row) => (
                <div key={row.applianceType} className="flex justify-between">
                  <span className="text-slate-700">{row.applianceType}</span>
                  <span className="font-semibold text-slate-900">{row._count.id}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Link
            href="/jobs/new"
            className="rounded-md border border-slate-300 bg-white py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            + New Job
          </Link>
          <Link
            href="/jobs/search"
            className="rounded-md border border-slate-300 bg-white py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Search
          </Link>
        </CardContent>
      </Card>

      {recentReady.length > 0 && (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Ready for Pickup</h3>
          <div className="space-y-2">
            {recentReady.map((job) => (
              <JobListCard
                key={job.id}
                id={job.id}
                jobNumber={job.jobNumber}
                status={job.status}
                customerName={job.customer.name}
                mobile={job.customer.mobile}
                applianceLine={[job.brand, job.applianceType].filter(Boolean).join(" ")}
                serviceAmount={job.serviceAmount}
              />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
