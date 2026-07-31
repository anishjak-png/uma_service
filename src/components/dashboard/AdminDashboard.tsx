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
    outsourcedJobs: number;
    warrantyJobs: number;
    todayCollection: number;
    monthlyCollection: number;
    pendingCollection: number;
    readyForPickup: Array<{
      id: string;
      jobNumber: string;
      brand: string;
      applianceType: string;
      readyAt?: string | Date | null;
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
      </div>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Quick Actions
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/jobs/new"
            className="rounded-md border border-slate-300 bg-white py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            New Job
          </Link>
          <Link
            href="/jobs/delivery"
            className="rounded-md border border-slate-300 bg-white py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Delivery
          </Link>
        </div>
      </section>

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
                label="Warranty"
                value={data.warrantyJobs}
                href="/jobs/pending?warranty=true"
                valueClassName="text-sky-700"
              />
              <StatCard
                label="Outsourced"
                value={data.outsourcedJobs}
                href="/jobs/search?status=Outsourced"
                valueClassName="text-purple-700"
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
        <ReadyPickupList jobs={data.readyForPickup} />
      </section>

      <Link
        href="/admin?tab=whatsapp"
        className="block rounded-md border border-slate-300 bg-white py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        WhatsApp Automation
      </Link>
    </div>
  );
}
