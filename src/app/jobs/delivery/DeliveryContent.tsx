"use client";

import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import { PageHeader } from "@/components/PageHeader";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type DeliveryJob = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand?: string | null;
  serviceAmount?: number | null;
  customer: { mobile: string; name?: string | null };
};

const DELIVERY_STATUSES = new Set(["Ready", "Return"]);

export default function DeliveryContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const loadJobs = useCallback(async (q: string) => {
    setLoading(true);
    setSuccessMsg("");
    const params = new URLSearchParams({ delivery: "true" });
    if (q.trim()) params.set("q", q.trim());

    const res = await fetch(`/api/jobs?${params}`);
    if (!res.ok) {
      setResults([]);
      setLoading(false);
      if (q.trim()) alert("Search failed");
      return;
    }

    const data = await res.json();
    setResults(
      Array.isArray(data)
        ? data.filter((j: DeliveryJob) => DELIVERY_STATUSES.has(j.status))
        : []
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadJobs(initialQ);
  }, [initialQ, loadJobs]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    loadJobs(query);
  }

  async function markDelivered(job: DeliveryJob) {
    if (!confirm(`Mark ${job.jobNumber} as delivered?`)) return;

    setDeliveringId(job.id);
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Delivered" }),
    });

    if (res.ok) {
      setResults((prev) => prev.filter((j) => j.id !== job.id));
      setSuccessMsg(`${job.jobNumber} marked as delivered`);
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to mark delivered");
    }

    setDeliveringId(null);
  }

  const hasSearch = query.trim().length > 0;

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Delivery"
          description="Ready and return-to-customer jobs only"
        />

        <form onSubmit={handleSearch} className="space-y-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search UT number or mobile number"
            className="flex h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-lg placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading && hasSearch ? "Searching…" : "Search"}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                loadJobs("");
              }}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Show All
            </button>
          </div>
        </form>

        {successMsg && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-800">
            {successMsg}
          </div>
        )}

        {loading ? (
          <p className="text-center text-slate-500">Loading…</p>
        ) : results.length === 0 ? (
          <p className="text-center text-slate-500">
            {hasSearch
              ? "No ready or return jobs found for this search"
              : "No jobs ready for delivery"}
          </p>
        ) : (
          <div className="space-y-2">
            {!hasSearch && (
              <p className="text-sm font-medium text-slate-600">
                {results.length} job{results.length === 1 ? "" : "s"} ready for pickup
              </p>
            )}
            {results.map((job) => (
              <JobListCard
                key={job.id}
                id={job.id}
                jobNumber={job.jobNumber}
                status={job.status}
                customerName={job.customer.name}
                mobile={job.customer.mobile}
                applianceLine={[job.brand, job.applianceType].filter(Boolean).join(" ")}
                serviceAmount={job.serviceAmount}
                footer={
                  <button
                    onClick={() => markDelivered(job)}
                    disabled={deliveringId === job.id}
                    className="w-full rounded-md bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {deliveringId === job.id ? "Updating…" : "Delivered"}
                  </button>
                }
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
