"use client";

import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/jobs";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type DeliveryJob = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand?: string | null;
  readyAt?: string | null;
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadJobs = useCallback(async (q: string) => {
    setLoading(true);
    setSuccessMsg("");
    const params = new URLSearchParams({ delivery: "true" });
    if (q.trim()) params.set("q", q.trim());

    const res = await fetch(`/api/jobs?${params}`);
    if (!res.ok) {
      setResults([]);
      setLoading(false);
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

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadJobs(value), 350);
  }

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
      <form onSubmit={handleSearch} className="mb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search UT or mobile"
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-base placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          autoFocus
        />
      </form>

      {successMsg && (
        <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-center text-xs font-medium text-green-800">
          {successMsg}
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : results.length === 0 ? (
        <p className="text-center text-sm text-slate-500">
          {hasSearch
            ? "No ready or return jobs for this search"
            : "No jobs ready for delivery"}
        </p>
      ) : (
        <div className="space-y-2">
          {!hasSearch && (
            <p className="text-xs text-slate-500">
              {results.length} ready for pickup
            </p>
          )}
          {results.map((job) => {
            const appliance = [job.brand, job.applianceType]
              .filter(Boolean)
              .join(" ");
            const readyLabel = job.readyAt ? formatDateTime(job.readyAt) : null;
            return (
              <JobListCard
                key={job.id}
                id={job.id}
                jobNumber={job.jobNumber}
                status={job.status}
                customerName={job.customer.name}
                mobile={job.customer.mobile}
                applianceLine={[appliance, readyLabel].filter(Boolean).join(" · ")}
                showServiceAmount={false}
                badge={
                  <div className="flex items-center gap-1.5">
                    {job.serviceAmount != null && (
                      <span className="text-xs font-bold text-emerald-700">
                        {formatCurrency(job.serviceAmount)}
                      </span>
                    )}
                    <JobStatusBadge status={job.status} />
                  </div>
                }
                footer={
                  <button
                    onClick={() => markDelivered(job)}
                    disabled={deliveringId === job.id}
                    className="w-full rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {deliveringId === job.id ? "Updating…" : "Delivered"}
                  </button>
                }
              />
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
