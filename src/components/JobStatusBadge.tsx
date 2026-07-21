import { STATUS_LABELS } from "@/lib/constants";

const statusColors: Record<string, string> = {
  Received: "bg-blue-100 text-blue-800",
  Diagnosing: "bg-yellow-100 text-yellow-800",
  InRepair: "bg-orange-100 text-orange-800",
  Ready: "bg-green-100 text-green-800",
  Delivered: "bg-gray-100 text-gray-700",
  Closed: "bg-gray-100 text-gray-500",
};

export function JobStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
