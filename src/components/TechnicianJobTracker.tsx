"use client";

import Link from "next/link";

export type TechnicianTrackerStats = {
  receivedTotal: number;
  pending: number;
  attended: number;
  delivered: number;
};

const SEGMENTS = [
  {
    key: "pending",
    label: "Pending",
    color: "bg-blue-500",
    textColor: "text-blue-700",
    href: "/jobs/search?status=Pending&scope=my",
  },
  {
    key: "attended",
    label: "Attended",
    sublabel: "Ready + Return",
    color: "bg-emerald-500",
    textColor: "text-emerald-700",
    href: "/jobs/search?status=Ready&scope=my",
  },
  {
    key: "delivered",
    label: "Delivered",
    color: "bg-slate-500",
    textColor: "text-slate-700",
    href: "/jobs/search?status=Delivered&scope=my",
  },
] as const;

function segmentValue(
  stats: TechnicianTrackerStats,
  key: "received" | (typeof SEGMENTS)[number]["key"]
) {
  if (key === "received") return stats.receivedTotal;
  if (key === "pending") return stats.pending;
  if (key === "attended") return stats.attended;
  return stats.delivered;
}

export function TechnicianJobTracker({ stats }: { stats: TechnicianTrackerStats }) {
  const other = Math.max(
    0,
    stats.receivedTotal - stats.pending - stats.attended - stats.delivered
  );
  const denominator = stats.receivedTotal || 1;

  const barParts = [
    { width: (stats.pending / denominator) * 100, className: "bg-blue-500" },
    { width: (stats.attended / denominator) * 100, className: "bg-emerald-500" },
    { width: (stats.delivered / denominator) * 100, className: "bg-slate-400" },
    { width: (other / denominator) * 100, className: "bg-amber-400" },
  ].filter((part) => part.width > 0);

  return (
    <section className="mb-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Your progress</h2>
        <span className="text-xs text-slate-500">
          {stats.receivedTotal} jobs on your board
        </span>
      </div>

      <div
        className="mt-2 flex h-3 overflow-hidden rounded-full bg-slate-100"
        aria-label="Job status breakdown"
      >
        {barParts.map((part, index) => (
          <div
            key={index}
            className={part.className}
            style={{ width: `${part.width}%` }}
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600" />
            <span className="text-xs font-medium text-slate-600">Received</span>
          </div>
          <p className="mt-0.5 text-lg font-bold text-emerald-800">
            {stats.receivedTotal}
          </p>
          <p className="text-[10px] text-slate-500">Jobs assigned to you</p>
        </div>
        {SEGMENTS.map((segment) => {
          const value = segmentValue(stats, segment.key);
          return (
            <Link
              key={segment.key}
              href={segment.href}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 transition-colors hover:bg-white"
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${segment.color}`} />
                <span className="text-xs font-medium text-slate-600">
                  {segment.label}
                </span>
              </div>
              <p className={`mt-0.5 text-lg font-bold ${segment.textColor}`}>
                {value}
              </p>
              {"sublabel" in segment && segment.sublabel ? (
                <p className="text-[10px] text-slate-500">{segment.sublabel}</p>
              ) : null}
            </Link>
          );
        })}
      </div>

      {other > 0 && (
        <p className="mt-2 text-[10px] text-slate-500">
          {other} other active (waiting approval, outsourced, warranty, etc.)
        </p>
      )}
    </section>
  );
}
