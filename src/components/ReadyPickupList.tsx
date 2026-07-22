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
    return <p className="text-sm text-slate-500">No products ready for pickup</p>;
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
        >
          <Link
            href={`/jobs/${job.id}`}
            className="min-w-0 flex-1 transition-colors hover:text-emerald-800"
          >
            <p className="font-semibold text-slate-900">{job.jobNumber}</p>
            <p className="text-sm text-slate-700">
              {[job.brand, job.applianceType].filter(Boolean).join(" ")}
            </p>
            {job.customer.name && (
              <p className="text-xs text-slate-500">{job.customer.name}</p>
            )}
            {showAmounts && job.serviceAmount != null && (
              <p className="mt-1 text-sm font-semibold text-emerald-700">
                {formatCurrency(job.serviceAmount)}
              </p>
            )}
          </Link>
          <CallCustomerButton mobile={job.customer.mobile} />
        </div>
      ))}
    </div>
  );
}
