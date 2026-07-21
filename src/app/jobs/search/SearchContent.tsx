"use client";

import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { daysSince } from "@/lib/jobs";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type JobResult = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand?: string | null;
  finalCost?: number | null;
  receivedAt: string;
  deliverySignature?: string | null;
  customer: { mobile: string; name?: string | null };
};

export default function SearchContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const initialStatus = searchParams.get("status");

  const [query, setQuery] = useState(initialQ);
  const [statusFilter, setStatusFilter] = useState(
    initialStatus ?? "active"
  );
  const [results, setResults] = useState<JobResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string, status: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status === "active") {
      params.set("active", "true");
    } else if (status !== "all") {
      params.set("status", status);
    }

    const res = await fetch(`/api/jobs?${params}`);
    const data = await res.json();
    setResults(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const status = initialStatus ?? "active";
    setStatusFilter(status);
    search(initialQ, status);
  }, [initialQ, initialStatus, search]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    search(query, statusFilter);
  }

  return (
    <AppShell>
      <PageHeader title="Search Jobs" description="Mobile number or job card #" />

      <form onSubmit={handleSearch} className="mb-4 space-y-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Mobile number or job card #"
          className="w-full rounded-md border border-slate-300 px-4 py-3 text-lg focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          autoFocus
        />

        <div className="flex flex-wrap gap-2">
          {[
            { value: "active", label: "Active" },
            { value: "Received", label: "Received" },
            { value: "Ready", label: "Ready" },
            { value: "Delivered", label: "Delivered" },
            { value: "all", label: "All" },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                statusFilter === f.value
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700"
        >
          Search
        </button>
      </form>

      {loading ? (
        <p className="text-center text-slate-500">Searching…</p>
      ) : results.length === 0 ? (
        <p className="text-center text-slate-500">No jobs found</p>
      ) : (
        <div className="space-y-2">
          {results.map((job) => (
            <JobListCard
              key={job.id}
              id={job.id}
              jobNumber={job.jobNumber}
              status={job.status}
              customerName={job.customer.name}
              mobile={job.customer.mobile}
              applianceLine={[job.brand, job.applianceType].filter(Boolean).join(" ")}
              meta={`${daysSince(new Date(job.receivedAt))} days ago`}
              finalCost={
                job.finalCost != null &&
                (job.status === "Ready" || job.status === "Delivered")
                  ? job.finalCost
                  : undefined
              }
              badge={
                <div className="text-right">
                  <JobStatusBadge status={job.status} />
                  {job.status === "Delivered" && job.deliverySignature && (
                    <p className="mt-1 text-xs font-medium text-emerald-700">
                      Signed ✓
                    </p>
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
