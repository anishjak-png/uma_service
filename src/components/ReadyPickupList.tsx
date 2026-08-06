import { JobListCard } from "@/components/JobListCard";
import { formatDoneDatestamp } from "@/lib/jobs";

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
          />
        );
      })}
    </div>
  );
}
