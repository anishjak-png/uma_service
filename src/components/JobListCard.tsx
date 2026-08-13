import type { DeliveryContactStatus } from "@prisma/client";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { CallCustomerButton } from "@/components/CallCustomerButton";
import { DeliveryCallButton } from "@/components/DeliveryCallButton";
import { DeliveryContactBadge } from "@/components/DeliveryContactBadge";
import { formatCurrency } from "@/lib/currency";
import {
  formatExpectedDeliveryDate,
  shouldShowDeliveryContact,
} from "@/lib/delivery-contact";
import { formatMobileDisplay } from "@/lib/jobs";
import { shouldShowJobServiceAmount } from "@/lib/job-assignee-display";
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
  emphasis?: string;
  assigneeName?: string | null;
  showAssignee?: boolean;
  meta?: ReactNode;
  serviceAmount?: number | null;
  showServiceAmount?: boolean;
  showCallIcon?: boolean;
  deliveryContactStatus?: DeliveryContactStatus;
  expectedDeliveryAt?: string | Date | null;
  enableDeliveryCallLog?: boolean;
  onDeliveryCallLogged?: (result: {
    deliveryContactStatus: DeliveryContactStatus;
    expectedDeliveryAt: string | null;
  }) => void;
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
  emphasis,
  assigneeName,
  showAssignee = false,
  meta,
  serviceAmount,
  showServiceAmount = true,
  showCallIcon = true,
  deliveryContactStatus,
  expectedDeliveryAt,
  enableDeliveryCallLog = false,
  onDeliveryCallLogged,
  badge,
  footer,
}: JobListCardProps) {
  const displayName = customerName ?? formatMobileDisplay(mobile);
  const pickupReady = shouldShowDeliveryContact(status);
  const contactStatus =
    pickupReady
      ? (deliveryContactStatus ?? "not_contacted")
      : deliveryContactStatus;
  const showContact = Boolean(pickupReady && contactStatus);
  // Ready/Return always open the delivery-call log (all staff roles).
  const useDeliveryCallLog = enableDeliveryCallLog || pickupReady;

  const assigneeText =
    showAssignee && assigneeName ? (
      <span className="font-medium text-slate-600">{assigneeName}</span>
    ) : showAssignee ? (
      <span className="text-slate-400">Unassigned</span>
    ) : null;

  const expectedLabel =
    contactStatus === "contacted"
      ? formatExpectedDeliveryDate(expectedDeliveryAt)
      : null;

  const metaParts: ReactNode[] = [];
  if (assigneeText) metaParts.push(assigneeText);
  if (meta) metaParts.push(meta);
  if (expectedLabel) {
    metaParts.push(
      <span key="expected" className="font-medium text-sky-700">
        Expected: {expectedLabel}
      </span>
    );
  }

  const detailLine = [applianceLine, complaint, emphasis].filter(Boolean).join(" · ");
  const displayAmount = shouldShowJobServiceAmount(
    status,
    serviceAmount,
    showServiceAmount
  );

  const callControl =
    showCallIcon &&
    (useDeliveryCallLog ? (
      <DeliveryCallButton
        jobId={id}
        jobNumber={jobNumber}
        customerName={customerName}
        mobile={mobile}
        onLogged={onDeliveryCallLogged}
      />
    ) : (
      <CallCustomerButton mobile={mobile} />
    ));

  return (
    <div className="rounded-md border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50">
      <div className="flex items-start gap-2.5 p-2.5">
        <Link href={`/jobs/${id}`} className="min-w-0 flex-1 active:scale-[0.99]">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-sm font-semibold text-slate-900">
              {jobNumber}
            </span>
            <span className="min-w-0 truncate text-sm text-slate-700">
              {displayName}
            </span>
          </div>
          {detailLine && (
            <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-slate-600">
              {detailLine}
            </p>
          )}
          {metaParts.length > 0 && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
              {metaParts.map((part, i) => (
                <span key={i}>
                  {i > 0 ? " · " : ""}
                  {part}
                </span>
              ))}
            </p>
          )}
          {displayAmount && (
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              {formatCurrency(serviceAmount)}
            </p>
          )}
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
          <div className="flex flex-wrap items-center justify-end gap-1">
            {badge ?? <JobStatusBadge status={status} />}
            {showContact && contactStatus && (
              <DeliveryContactBadge status={contactStatus} />
            )}
          </div>
          {callControl}
        </div>
      </div>
      {footer && (
        <div className="border-t border-slate-100 px-2.5 pb-2.5 pt-2">{footer}</div>
      )}
    </div>
  );
}
