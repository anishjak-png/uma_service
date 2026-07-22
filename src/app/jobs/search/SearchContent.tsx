"use client";

import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { PageHeader } from "@/components/PageHeader";
import {
  TechnicianJobScopeToggle,
  useTechnicianJobScope,
  type TechnicianJobScope,
} from "@/components/TechnicianJobScopeToggle";
import { STATUS_LABELS } from "@/lib/constants";
import { daysSince, formatMobileDisplay, normalizeMobile } from "@/lib/jobs";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type JobResult = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand?: string | null;
  receivedAt: string;
  serviceAmount?: number | null;
  customer: { mobile: string; name?: string | null };
};

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "WaitingForCustomerApproval", label: "Waiting Approval" },
  { value: "Ready", label: "Ready" },
  { value: "Return", label: "Return" },
  { value: "Delivered", label: "Delivered" },
] as const;

export default function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const initialStatus = searchParams.get("status") ?? "all";

  const [query, setQuery] = useState(initialQ);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [results, setResults] = useState<JobResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const { scope, setScope, ready: scopeReady } = useTechnicianJobScope();

  const search = useCallback(
    async (q: string, status: string, jobScope: TechnicianJobScope, isTechnician: boolean) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);
      if (isTechnician) params.set("scope", jobScope);

      const res = await fetch(`/api/jobs?${params}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setRole(data.role ?? null);
        setRoleLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!roleLoaded) return;
    if (role === "technician" && !scopeReady) return;

    setQuery(initialQ);
    setStatusFilter(initialStatus);
    search(
      initialQ,
      initialStatus,
      role === "technician" ? scope : "all",
      role === "technician"
    );
  }, [
    initialQ,
    initialStatus,
    role,
    roleLoaded,
    scope,
    scopeReady,
    search,
  ]);

  function runSearch(q: string, status: string) {
    search(q, status, role === "technician" ? scope : "all", role === "technician");
  }

  function applyFilter(status: string) {
    setStatusFilter(status);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status !== "all") params.set("status", status);
    router.replace(`/jobs/search?${params.toString()}`, { scroll: false });
    runSearch(query, status);
  }

  function handleScopeChange(next: TechnicianJobScope) {
    setScope(next);
    runSearch(query, statusFilter);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    router.replace(`/jobs/search?${params.toString()}`, { scroll: false });
    runSearch(query, statusFilter);
  }

  const mobileDigits = normalizeMobile(query);
  const isMobileSearch = mobileDigits.length === 10;
  const showCustomerHistory = isMobileSearch && results.length > 0;
  const isTechnician = role === "technician";

  return (
    <AppShell>
      <PageHeader
        title="Search Jobs"
        description={
          isTechnician && scope === "my"
            ? "Search your assigned jobs"
            : "UT number, mobile number, or customer name"
        }
      />

      {isTechnician && (
        <div className="mb-4">
          <TechnicianJobScopeToggle scope={scope} onChange={handleScopeChange} />
        </div>
      )}

      <form onSubmit={handleSearch} className="mb-4 space-y-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="UT number, mobile, or customer name"
          className="flex h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-lg placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          autoFocus
        />

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => applyFilter(f.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Search
        </button>
      </form>

      {loading ? (
        <p className="text-center text-slate-500">Searching…</p>
      ) : results.length === 0 ? (
        <p className="text-center text-slate-500">No jobs found</p>
      ) : (
        <div className="space-y-4">
          {showCustomerHistory && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="font-semibold text-emerald-900">Customer Service History</h3>
              <p className="text-sm text-emerald-700">
                {formatMobileDisplay(mobileDigits)} — {results.length} record
                {results.length === 1 ? "" : "s"}
                {isTechnician && scope === "my" ? " (your assigned jobs)" : ""}
              </p>
              <div className="mt-3 space-y-2">
                {results.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{job.jobNumber}</p>
                      <p className="text-slate-600">
                        {[job.brand, job.applianceType].filter(Boolean).join(" ")}
                      </p>
                    </div>
                    <JobStatusBadge status={job.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

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
                serviceAmount={job.serviceAmount}
                meta={`${daysSince(new Date(job.receivedAt))} days · ${STATUS_LABELS[job.status] ?? job.status}`}
              />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
