import { formatCurrency } from "@/lib/currency";
import { CallCustomerButton } from "@/components/CallCustomerButton";
import Link from "next/link";

type ReadyJob = {
  id: string;
  jobNumber: string;
  brand: string;
  applianceType: string;
  serviceAmount?: number | null;
  customer: { name?: string | null; mobile: string };
};

export function ReadyPickupList({
  jobs,
  showAmounts = false,
}: {
  jobs: ReadyJob[];
  showAmounts?: boolean;
}) {
  if (jobs.length === 0) {
    return <p className="text-xs text-slate-500">No products ready for pickup</p>;
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="rounded-md border border-slate-200 bg-white p-2.5"
        >
          <Link href={`/jobs/${job.id}`} className="block">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {job.jobNumber}
              </p>
              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                Ready
              </span>
            </div>
          </Link>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <Link
              href={`/jobs/${job.id}`}
              className="min-w-0 flex-1 truncate text-sm text-slate-700"
            >
              {job.customer.name ?? job.customer.mobile}
            </Link>
            <CallCustomerButton mobile={job.customer.mobile} className="shrink-0" />
          </div>
          <Link href={`/jobs/${job.id}`} className="block">
            <p className="mt-0.5 truncate text-xs text-slate-600">
              {[job.brand, job.applianceType].filter(Boolean).join(" ")}
            </p>
            {showAmounts && job.serviceAmount != null && (
              <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                {formatCurrency(job.serviceAmount)}
              </p>
            )}
          </Link>
        </div>
      ))}
    </div>
  );
}
