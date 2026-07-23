import Link from "next/link";
import { ReadyPickupList } from "@/components/ReadyPickupList";
import { StatCard } from "@/components/StatCard";

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
    <div className="space-y-3">
      <Link
        href="/jobs/new"
        className="block rounded-md bg-emerald-600 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-700"
      >
        New Job
      </Link>

      <Link
        href="/jobs/search"
        className="block rounded-md border border-slate-300 bg-white py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Search
      </Link>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ready for Delivery
        </p>
        <ReadyPickupList jobs={data.readyForPickup} showAmounts={showAmounts} />
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Today&apos;s Jobs
        </p>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Today" value={data.todayJobs} />
          <StatCard
            label="Pending"
            value={data.pendingJobs}
            href="/jobs/search?status=Pending"
            valueClassName="text-blue-700"
          />
          <StatCard
            label="Ready"
            value={data.readyJobs}
            href="/jobs/search?status=Ready"
            valueClassName="text-emerald-700"
          />
          <StatCard
            label="Waiting Approval"
            value={data.waitingApprovalJobs}
            href="/jobs/search?status=WaitingForCustomerApproval"
            valueClassName="text-amber-700"
          />
        </div>
      </section>
    </div>
  );
}
