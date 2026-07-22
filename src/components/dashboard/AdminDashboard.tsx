import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ReadyPickupList } from "@/components/ReadyPickupList";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";

type AdminDashboardProps = {
  data: {
    todayJobs: number;
    pendingJobs: number;
    readyJobs: number;
    deliveredJobs: number;
    waitingApprovalJobs: number;
    todayCollection: number;
    monthlyCollection: number;
    pendingCollection: number;
    readyForPickup: Array<{
      id: string;
      jobNumber: string;
      brand: string;
      applianceType: string;
      serviceAmount?: number | null;
      customer: { name?: string | null; mobile: string };
    }>;
  };
};

export function AdminDashboard({ data }: AdminDashboardProps) {
  return (
    <>
      <PageHeader title="Admin Dashboard" description="Service overview & finances" />

      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard label="Today's Jobs" value={data.todayJobs} />
        <StatCard
          label="Pending Jobs"
          value={data.pendingJobs}
          href="/jobs/search?status=Pending"
          valueClassName="text-blue-700"
        />
        <StatCard
          label="Ready Jobs"
          value={data.readyJobs}
          href="/jobs/search?status=Ready"
          valueClassName="text-emerald-700"
        />
        <StatCard
          label="Delivered Jobs"
          value={data.deliveredJobs}
          href="/jobs/search?status=Delivered"
        />
        <StatCard
          label="Waiting for Approval"
          value={data.waitingApprovalJobs}
          href="/jobs/search?status=WaitingForCustomerApproval"
          valueClassName="text-amber-700"
        />
        <StatCard
          label="Today's Collection"
          value={formatCurrency(data.todayCollection)}
          valueClassName="text-emerald-800"
        />
        <StatCard
          label="Monthly Collection"
          value={formatCurrency(data.monthlyCollection)}
          valueClassName="text-emerald-800"
        />
        <StatCard
          label="Pending Collection"
          value={formatCurrency(data.pendingCollection)}
          subtext="Ready, not yet delivered"
          valueClassName="text-amber-800"
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Ready for Pickup</CardTitle>
        </CardHeader>
        <CardContent>
          <ReadyPickupList jobs={data.readyForPickup} showAmounts />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2">
          <Link
            href="/jobs/new"
            className="rounded-md bg-emerald-600 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700"
          >
            New Job
          </Link>
          <Link
            href="/jobs/search"
            className="rounded-md border border-slate-300 bg-white py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Search
          </Link>
          <Link
            href="/admin?tab=reports"
            className="rounded-md border border-slate-300 bg-white py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reports
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
