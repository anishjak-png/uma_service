"use client";

export function JobStatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const statusColors: Record<string, string> = {
    Pending: "bg-blue-100 text-blue-800",
    WaitingForCustomerApproval: "bg-amber-100 text-amber-800",
    Outsourced: "bg-purple-100 text-purple-800",
    WarrantyPending: "bg-sky-100 text-sky-800",
    WarrantyWithCompany: "bg-sky-100 text-sky-800",
    Ready: "bg-green-100 text-green-800",
    Return: "bg-orange-100 text-orange-800",
    Delivered: "bg-slate-100 text-slate-700",
  };

  const labels: Record<string, string> = {
    Pending: "Pending",
    WaitingForCustomerApproval: "Waiting for Approval",
    Outsourced: "Outsourced",
    WarrantyPending: "Warranty",
    WarrantyWithCompany: "Warranty",
    Ready: "Ready",
    Return: "Return",
    Delivered: "Delivered",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[status] ?? "bg-slate-100 text-slate-700"} ${className}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
