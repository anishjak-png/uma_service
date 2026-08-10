"use client";

import type { DeliveryContactStatus } from "@prisma/client";
import { JobListCard } from "@/components/JobListCard";
import { formatDoneDatestamp } from "@/lib/jobs";
import { useMemo, useState } from "react";

type ReadyJob = {
  id: string;
  jobNumber: string;
  brand: string;
  applianceType: string;
  readyAt?: string | Date | null;
  serviceAmount?: number | null;
  deliveryContactStatus: DeliveryContactStatus;
  expectedDeliveryAt?: string | Date | null;
  customer: { name?: string | null; mobile: string };
  completedByTechnician?: { name: string } | null;
  completedByOutsource?: { name: string } | null;
};

type ContactFilter = "all" | "not_contacted" | "contacted";

function FilterTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        active
          ? "bg-slate-800 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label} ({count})
    </button>
  );
}

export function ReadyPickupList({ jobs: initialJobs }: { jobs: ReadyJob[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [filter, setFilter] = useState<ContactFilter>("all");

  const counts = useMemo(
    () => ({
      all: jobs.length,
      not_contacted: jobs.filter((j) => j.deliveryContactStatus === "not_contacted")
        .length,
      contacted: jobs.filter((j) => j.deliveryContactStatus === "contacted").length,
    }),
    [jobs]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return jobs;
    return jobs.filter((j) => j.deliveryContactStatus === filter);
  }, [jobs, filter]);

  function handleCallLogged(
    jobId: string,
    result: {
      deliveryContactStatus: DeliveryContactStatus;
      expectedDeliveryAt: string | null;
    }
  ) {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              deliveryContactStatus: result.deliveryContactStatus,
              expectedDeliveryAt: result.expectedDeliveryAt,
            }
          : j
      )
    );
  }

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ready for Delivery
        </p>
        <div className="flex flex-wrap gap-1.5">
          <FilterTab
            active={filter === "all"}
            label="All"
            count={counts.all}
            onClick={() => setFilter("all")}
          />
          <FilterTab
            active={filter === "not_contacted"}
            label="Not contacted"
            count={counts.not_contacted}
            onClick={() => setFilter("not_contacted")}
          />
          <FilterTab
            active={filter === "contacted"}
            label="Contacted"
            count={counts.contacted}
            onClick={() => setFilter("contacted")}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-slate-500">
          {jobs.length === 0
            ? "No products ready for pickup"
            : "No jobs in this filter"}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((job) => {
            const appliance = [job.brand, job.applianceType].filter(Boolean).join(" ");
            const repairedBy =
              job.completedByTechnician?.name ??
              (job.completedByOutsource
                ? `Outsource · ${job.completedByOutsource.name}`
                : null);
            const doneLabel = formatDoneDatestamp(job.readyAt);

            return (
              <JobListCard
                key={job.id}
                id={job.id}
                jobNumber={job.jobNumber}
                status="Ready"
                customerName={job.customer.name}
                mobile={job.customer.mobile}
                applianceLine={appliance}
                serviceAmount={job.serviceAmount}
                meta={[repairedBy, doneLabel].filter(Boolean).join(" · ")}
                deliveryContactStatus={job.deliveryContactStatus}
                expectedDeliveryAt={job.expectedDeliveryAt}
                enableDeliveryCallLog
                onDeliveryCallLogged={(result) => handleCallLogged(job.id, result)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
