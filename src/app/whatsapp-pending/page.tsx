"use client";

import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { buildReadyMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { useCallback, useEffect, useState } from "react";

type PendingJob = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand?: string | null;
  finalCost?: number | null;
  readyAt?: string | null;
  customer: { mobile: string; name?: string | null };
};

export default function WhatsAppPendingPage() {
  const [jobs, setJobs] = useState<PendingJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    const res = await fetch("/api/whatsapp-pending");
    const data = await res.json();
    setJobs(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  function openWhatsApp(job: PendingJob) {
    const message = buildReadyMessage({
      customerName: job.customer.name,
      applianceType: job.applianceType,
      brand: job.brand,
      jobNumber: job.jobNumber,
      finalCost: job.finalCost,
    });
    const url = buildWhatsAppUrl(job.customer.mobile, message);
    window.open(url, "_blank");
  }

  async function markSent(jobId: string) {
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readyWhatsappSent: true }),
    });
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  }

  return (
    <AppShell whatsappPending={jobs.length}>
      <PageHeader
        title="WhatsApp Pending"
        description="Ready jobs awaiting customer notification"
      />

      {loading ? (
        <p className="text-center text-slate-500">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="font-semibold text-emerald-800">All caught up!</p>
          <p className="text-sm text-emerald-600">No pending WhatsApp messages</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {jobs.length} customer(s) to notify. Tap card to view job, or use buttons below.
          </p>

          {jobs.map((job) => (
            <JobListCard
              key={job.id}
              id={job.id}
              jobNumber={job.jobNumber}
              status="Ready"
              customerName={job.customer.name}
              mobile={job.customer.mobile}
              applianceLine={[job.brand, job.applianceType].filter(Boolean).join(" ")}
              finalCost={job.finalCost}
              meta={
                job.readyAt
                  ? `Ready ${new Date(job.readyAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}`
                  : undefined
              }
              badge={<JobStatusBadge status="Ready" />}
              footer={
                <div className="flex gap-2">
                  <button
                    onClick={() => openWhatsApp(job)}
                    className="flex-1 rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Send WhatsApp
                  </button>
                  <button
                    onClick={() => markSent(job.id)}
                    className="flex-1 rounded-md border border-emerald-600 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    Mark Sent
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
