import { JobStatusBadge } from "@/components/JobStatusBadge";
import { formatMobileDisplay } from "@/lib/jobs";
import Link from "next/link";
import { ReactNode } from "react";

export type JobListCardProps = {
  id: string;
  jobNumber: string;
  status: string;
  customerName?: string | null;
  mobile: string;
  applianceLine: string;
  complaint?: string;
  meta?: string;
  finalCost?: number | null;
  badge?: ReactNode;
  footer?: ReactNode;
};

export function JobListCard({
  id,
  jobNumber,
  status,
  customerName,
  mobile,
  applianceLine,
  complaint,
  meta,
  finalCost,
  badge,
  footer,
}: JobListCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50">
      <Link href={`/jobs/${id}`} className="block p-4 active:scale-[0.99]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{jobNumber}</p>
            <p className="text-sm font-medium text-slate-700">
              {customerName ?? formatMobileDisplay(mobile)}
            </p>
            <p className="mt-1 text-sm text-slate-600">{applianceLine}</p>
            {complaint && (
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                {complaint}
              </p>
            )}
            {meta && <p className="mt-2 text-xs text-slate-400">{meta}</p>}
          </div>
          <div className="shrink-0 text-right">
            {badge ?? <JobStatusBadge status={status} />}
            {finalCost != null && (
              <p className="mt-1 text-sm font-bold text-emerald-700">
                Rs {finalCost}
              </p>
            )}
          </div>
        </div>
      </Link>
      {footer && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">{footer}</div>
      )}
    </div>
  );
}
