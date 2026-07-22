"use client";

export function JobStatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    Pending: "bg-blue-100 text-blue-800",
    WaitingForCustomerApproval: "bg-amber-100 text-amber-800",
    Ready: "bg-green-100 text-green-800",
    Return: "bg-orange-100 text-orange-800",
    Delivered: "bg-slate-100 text-slate-700",
  };

  const labels: Record<string, string> = {
    Pending: "Pending",
    WaitingForCustomerApproval: "Waiting for Approval",
    Ready: "Ready",
    Return: "Return",
    Delivered: "Delivered",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
