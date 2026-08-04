import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/jobs";
import { CallCustomerButton } from "@/components/CallCustomerButton";
import Link from "next/link";

type ReadyJob = {
  id: string;
  jobNumber: string;
  brand: string;
  applianceType: string;
  readyAt?: string | Date | null;
  serviceAmount?: number | null;
  customer: { name?: string | null; mobile: string };
  completedByTechnician?: { name: string } | null;
  completedByOutsource?: { name: string } | null;
};

export function ReadyPickupList({ jobs }: { jobs: ReadyJob[] }) {
  if (jobs.length === 0) {
    return <p className="text-xs text-slate-500">No products ready for pickup</p>;
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const appliance = [job.brand, job.applianceType].filter(Boolean).join(" ");
        const repairedBy =
          job.completedByTechnician?.name ??
          (job.completedByOutsource
            ? `Outsource · ${job.completedByOutsource.name}`
            : null);
        const readyLabel = job.readyAt ? formatDateTime(job.readyAt) : null;
        return (
          <div
            key={job.id}
            className="rounded-md border border-slate-200 bg-white p-2.5"
          >
            <Link href={`/jobs/${job.id}`} className="block">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                  {job.jobNumber}
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  {job.serviceAmount != null && (
                    <span className="text-xs font-bold text-emerald-700">
                      {formatCurrency(job.serviceAmount)}
                    </span>
                  )}
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    Ready
                  </span>
                </div>
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
                {[appliance, repairedBy, readyLabel].filter(Boolean).join(" · ")}
              </p>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
