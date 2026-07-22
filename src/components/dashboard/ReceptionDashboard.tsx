import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ReadyPickupList } from "@/components/ReadyPickupList";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReceptionDashboardProps = {
  data: {
    todayJobs: number;
    pendingJobs: number;
    readyJobs: number;
    waitingApprovalJobs: number;
    readyForPickup: Array<{
      id: string;
      jobNumber: string;
      brand: string;
      applianceType: string;
      serviceAmount?: number | null;
      customer: { name?: string | null; mobile: string };
    }>;
  };
  showAmounts: boolean;
};

export function ReceptionDashboard({ data, showAmounts }: ReceptionDashboardProps) {
  return (
    <>
      <PageHeader title="Service Counter" description="Today's overview" />

      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard label="Today's Jobs" value={data.todayJobs} />
        <StatCard
          label="Pending Jobs"
          value={data.pendingJobs}
          href="/jobs/search?status=Pending"
          valueClassName="text-blue-700"
        />
        <StatCard
          label="Ready for Pickup"
          value={data.readyJobs}
          href="/jobs/search?status=Ready"
          valueClassName="text-emerald-700"
        />
        <StatCard
          label="Waiting for Approval"
          value={data.waitingApprovalJobs}
          href="/jobs/search?status=WaitingForCustomerApproval"
          valueClassName="text-amber-700"
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Ready for Pickup Products</CardTitle>
        </CardHeader>
        <CardContent>
          <ReadyPickupList jobs={data.readyForPickup} showAmounts={showAmounts} />
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
            href="/jobs/delivery"
            className="rounded-md border border-slate-300 bg-white py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Delivery
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
