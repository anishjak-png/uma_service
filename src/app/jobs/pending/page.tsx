"use client";

import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import { PageHeader } from "@/components/PageHeader";
import { daysSince, formatMobileDisplay } from "@/lib/jobs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type PendingJob = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand?: string | null;
  complaint: string;
  receivedAt: string;
  customer: { mobile: string; name?: string | null };
  assignedTechnician?: { id: string; name: string } | null;
};

export default function PendingJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<PendingJob[]>([]);
  const [technicianName, setTechnicianName] = useState("");
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    const meRes = await fetch("/api/auth/me");
    const me = await meRes.json();

    if (!me.isLoggedIn) {
      router.push("/");
      return;
    }

    if (me.role === "technician" && !me.technicianId) {
      router.push("/technician/select");
      return;
    }

    setTechnicianName(me.technicianName ?? "");

    const params = new URLSearchParams({ pendingForTechnician: "true" });
    if (me.role === "technician" && me.technicianId) {
      params.set("technicianId", me.technicianId);
    }

    const res = await fetch(`/api/jobs?${params}`);
    setJobs(await res.json());
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  return (
    <AppShell>
      <PageHeader
        title="Pending Jobs"
        description={
          technicianName
            ? `Assigned to ${technicianName} · Tap a job to open`
            : "Tap a job to open and update"
        }
      />

      {loading ? (
        <p className="text-center text-slate-500">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="font-semibold text-emerald-800">No pending jobs</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <JobListCard
              key={job.id}
              id={job.id}
              jobNumber={job.jobNumber}
              status={job.status}
              customerName={job.customer.name}
              mobile={job.customer.mobile}
              applianceLine={[job.brand, job.applianceType].filter(Boolean).join(" ")}
              complaint={job.complaint}
              meta={`${daysSince(new Date(job.receivedAt))} days · ${new Date(job.receivedAt).toLocaleDateString("en-IN")}${job.assignedTechnician ? ` · ${job.assignedTechnician.name}` : ""}`}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
