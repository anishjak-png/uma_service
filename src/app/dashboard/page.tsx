import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatMobileDisplay } from "@/lib/jobs";

async function getStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [received, diagnosing, inRepair, ready, whatsappPending, deliveredToday, overdue, recentReady] =
    await Promise.all([
      prisma.jobCard.count({ where: { status: "Received" } }),
      prisma.jobCard.count({ where: { status: "Diagnosing" } }),
      prisma.jobCard.count({ where: { status: "InRepair" } }),
      prisma.jobCard.count({ where: { status: "Ready" } }),
      prisma.jobCard.count({ where: { status: "Ready", readyWhatsappSent: false } }),
      prisma.jobCard.count({
        where: { status: "Delivered", deliveredAt: { gte: today, lt: tomorrow } },
      }),
      prisma.jobCard.count({
        where: {
          status: { in: ["Received", "Diagnosing", "InRepair"] },
          receivedAt: { lt: sevenDaysAgo },
        },
      }),
      prisma.jobCard.findMany({
        where: { status: "Ready" },
        include: { customer: true },
        orderBy: { readyAt: "desc" },
        take: 8,
      }),
    ]);

  return {
    counts: {
      received,
      diagnosing,
      inRepair,
      ready,
      whatsappPending,
      deliveredToday,
      overdue,
      active: received + diagnosing + inRepair + ready,
    },
    recentReady,
  };
}

export default async function DashboardPage() {
  const { counts, recentReady } = await getStats();

  return (
    <AppShell whatsappPending={counts.whatsappPending}>
      <PageHeader
        title="Dashboard"
        description={`${counts.active} active jobs`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Received"
          value={counts.received}
          href="/jobs/search?status=Received"
        />
        <StatCard
          label="Diagnosing"
          value={counts.diagnosing}
          href="/jobs/search?status=Diagnosing"
          valueClassName="text-yellow-700"
        />
        <StatCard
          label="In Repair"
          value={counts.inRepair}
          href="/jobs/search?status=InRepair"
          valueClassName="text-orange-700"
        />
        <StatCard
          label="Ready"
          value={counts.ready}
          href="/jobs/search?status=Ready"
          valueClassName="text-emerald-700"
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Delivery — Ready"
          value={counts.ready}
          subtext="Tap to open delivery"
          href="/jobs/delivery"
          valueClassName="text-blue-700"
        />
        <StatCard
          label="WhatsApp Pending"
          value={counts.whatsappPending}
          subtext="Ready jobs to notify"
          href="/whatsapp-pending"
          valueClassName="text-emerald-700"
        />
      </div>

      <div className="mb-6">
        <StatCard
          label="Delivered Today"
          value={counts.deliveredToday}
          href="/jobs/search?status=Delivered"
        />
      </div>

      {counts.overdue > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {counts.overdue} job(s) pending over 7 days
        </div>
      )}

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
          <h3 className="mb-3 text-lg font-semibold text-slate-900">
            Ready for Pickup
          </h3>
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
                finalCost={job.finalCost}
              />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
