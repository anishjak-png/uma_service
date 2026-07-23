import Link from "next/link";
import { ReadyPickupList } from "@/components/ReadyPickupList";
import { StatCard } from "@/components/StatCard";
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
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
          subtext="Ready, not delivered"
          valueClassName="text-amber-800"
        />
        <Link
          href="/admin?tab=reports"
          className="flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-center text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          Reports &amp; Analytics
        </Link>
      </div>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Job Stats
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
            label="Delivered"
            value={data.deliveredJobs}
            href="/jobs/search?status=Delivered"
          />
        </div>
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ready for Delivery
        </p>
        <ReadyPickupList jobs={data.readyForPickup} showAmounts />
      </section>

      <Link
        href="/admin"
        className="block rounded-md border border-slate-300 bg-white py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Admin Settings
      </Link>
    </div>
  );
}
