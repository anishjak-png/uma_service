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

export default function DeliveryContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;

    setLoading(true);
    setSuccessMsg("");
    const params = new URLSearchParams({ q: q.trim() });

    const res = await fetch(`/api/jobs?${params}`);
    if (!res.ok) {
      setResults([]);
      setSearched(true);
      setLoading(false);
      alert("Search failed");
      return;
    }

    const data = await res.json();
    setResults(Array.isArray(data) ? data : []);
    setSearched(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialQ) search(initialQ);
  }, [initialQ, search]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    search(query);
  }

  async function markDelivered(job: DeliveryJob) {
    if (job.status === "Delivered") {
      alert(`${job.jobNumber} is already delivered.`);
      return;
    }

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

  const deliverable = results.filter((j) => j.status !== "Delivered");
  const delivered = results.filter((j) => j.status === "Delivered");

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Delivery" description="Search job card and mark delivered" />

        <form onSubmit={handleSearch} className="space-y-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="UT number or mobile number"
            className="flex h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-lg placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? "Searching…" : "Find Job"}
          </button>
        </form>

        {successMsg && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-800">
            {successMsg}
          </div>
        )}

        {searched && !loading && results.length === 0 && (
          <p className="text-center text-slate-500">No jobs found</p>
        )}

        {deliverable.length > 0 && (
          <div className="space-y-2">
            {deliverable.map((job) => (
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

        {delivered.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500">Already delivered</p>
            {delivered.map((job) => (
              <JobListCard
                key={job.id}
                id={job.id}
                jobNumber={job.jobNumber}
                status={job.status}
                customerName={job.customer.name}
                mobile={job.customer.mobile}
                applianceLine={[job.brand, job.applianceType].filter(Boolean).join(" ")}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
