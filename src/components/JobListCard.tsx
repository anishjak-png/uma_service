import { JobStatusBadge } from "@/components/JobStatusBadge";
import { CallCustomerButton } from "@/components/CallCustomerButton";
import { formatCurrency } from "@/lib/currency";
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
  serviceAmount?: number | null;
  showServiceAmount?: boolean;
  showCallIcon?: boolean;
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
  serviceAmount,
  showServiceAmount = true,
  showCallIcon = true,
  badge,
  footer,
}: JobListCardProps) {
  const displayName = customerName ?? formatMobileDisplay(mobile);

  return (
    <div className="rounded-md border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50">
      <div className="p-2.5">
        <Link href={`/jobs/${id}`} className="block active:scale-[0.99]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">{jobNumber}</p>
            <div className="shrink-0">
              {badge ?? <JobStatusBadge status={status} />}
            </div>
          </div>
        </Link>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <Link
            href={`/jobs/${id}`}
            className="min-w-0 flex-1 truncate text-sm text-slate-700"
          >
            {displayName}
          </Link>
          {showCallIcon && (
            <CallCustomerButton mobile={mobile} className="shrink-0" />
          )}
        </div>
        <Link href={`/jobs/${id}`} className="block">
          {applianceLine && (
            <p className="mt-0.5 truncate text-xs text-slate-600">
              {applianceLine}
            </p>
          )}
          {complaint && (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
              {complaint}
            </p>
          )}
          {meta && (
            <p className="mt-1 line-clamp-1 text-xs text-slate-400">{meta}</p>
          )}
          {showServiceAmount && serviceAmount != null && (
            <p className="mt-0.5 text-xs font-semibold text-emerald-700">
              {formatCurrency(serviceAmount)}
            </p>
          )}
        </Link>
      </div>
      {footer && (
        <div className="border-t border-slate-100 px-2.5 pb-2.5 pt-2">{footer}</div>
      )}
    </div>
  );
}
