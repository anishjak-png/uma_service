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
import { useAuth } from "@/components/AuthProvider";
import { CallCustomerButton } from "@/components/CallCustomerButton";
import { formatCurrency } from "@/lib/currency";
import { formatMobileDisplay, formatDateTime } from "@/lib/jobs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type JobResult = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand?: string | null;
  receivedAt: string;
  readyAt?: string | null;
  deliveredAt?: string | null;
  serviceAmount?: number | null;
  customer: { mobile: string; name?: string | null };
};

type CustomerInfo = {
  id: string;
  name?: string | null;
  mobile: string;
};

type CustomerPick = CustomerInfo & { jobCount: number };

type SearchResponse =
  | {
      mode: "jobs";
      searchType: "empty" | "mobile" | "ut" | "name";
      customer: CustomerInfo | null;
      totalVisits?: number;
      jobs: JobResult[];
    }
  | {
      mode: "customer_pick";
      searchType: "name";
      customers: CustomerPick[];
    };

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "WaitingForCustomerApproval", label: "Waiting Approval" },
  { value: "Ready", label: "Ready" },
  { value: "Return", label: "Return" },
  { value: "Delivered", label: "Delivered" },
] as const;

function ServiceHistoryTable({
  jobs,
  showAmounts,
}: {
  jobs: JobResult[];
  showAmounts: boolean;
}) {
  return (
    <div className="mt-4 space-y-2">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="flex items-start gap-2 rounded-md border border-emerald-100 bg-white p-3 text-sm"
        >
          <Link
            href={`/jobs/${job.id}`}
            className="min-w-0 flex-1 transition-colors hover:bg-emerald-50/50"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-slate-900">{job.jobNumber}</p>
              <JobStatusBadge status={job.status} />
            </div>
            <div className="mt-2 grid gap-1 text-slate-600 sm:grid-cols-2">
              <p>
                <span className="font-medium text-slate-700">Product:</span>{" "}
                {job.applianceType}
              </p>
              <p>
                <span className="font-medium text-slate-700">Brand:</span>{" "}
                {job.brand ?? "—"}
              </p>
              <p>
                <span className="font-medium text-slate-700">Status:</span>{" "}
                {job.status}
              </p>
              <p>
                <span className="font-medium text-slate-700">Received:</span>{" "}
                {formatDateTime(job.receivedAt)}
              </p>
              {job.readyAt && (
                <p>
                  <span className="font-medium text-slate-700">Completed:</span>{" "}
                  {formatDateTime(job.readyAt)}
                </p>
              )}
              {job.deliveredAt && (
                <p>
                  <span className="font-medium text-slate-700">Delivered:</span>{" "}
                  {formatDateTime(job.deliveredAt)}
                </p>
              )}
              {showAmounts && job.serviceAmount != null && (
                <p>
                  <span className="font-medium text-slate-700">Amount:</span>{" "}
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(job.serviceAmount)}
                  </span>
                </p>
              )}
            </div>
          </Link>
          <CallCustomerButton mobile={job.customer.mobile} />
        </div>
      ))}
    </div>
  );
}

export default function SearchContent() {
  const router = useRouter();
  const { role, loaded: roleLoaded } = useAuth();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const initialStatus = searchParams.get("status") ?? "all";
  const initialCustomerId = searchParams.get("customerId") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { scope, setScope, ready: scopeReady } = useTechnicianJobScope();

  const search = useCallback(
    async (
      q: string,
      status: string,
      selectedCustomerId: string,
      jobScope: TechnicianJobScope,
      isTechnician: boolean
    ) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCustomerId) {
        params.set("customerId", selectedCustomerId);
      } else if (q.trim()) {
        params.set("q", q.trim());
      }
      if (status !== "all") params.set("status", status);
      if (isTechnician) params.set("scope", jobScope);

      const res = await fetch(`/api/jobs/search?${params}`);
      const data = await res.json();
      setResponse(data);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    if (!roleLoaded) return;
    if (role === "technician" && !scopeReady) return;

    setQuery(initialQ);
    setStatusFilter(initialStatus);
    setCustomerId(initialCustomerId);
    search(
      initialQ,
      initialStatus,
      initialCustomerId,
      role === "technician" ? scope : "all",
      role === "technician"
    );
  }, [
    initialQ,
    initialStatus,
    initialCustomerId,
    role,
    roleLoaded,
    scope,
    scopeReady,
    search,
  ]);

  function updateUrl(q: string, status: string, selectedCustomerId: string) {
    const params = new URLSearchParams();
    if (selectedCustomerId) {
      params.set("customerId", selectedCustomerId);
      if (q.trim()) params.set("q", q.trim());
    } else if (q.trim()) {
      params.set("q", q.trim());
    }
    if (status !== "all") params.set("status", status);
    router.replace(`/jobs/search?${params.toString()}`, { scroll: false });
  }

  function runSearch(
    q: string,
    status: string,
    selectedCustomerId: string = customerId
  ) {
    search(
      q,
      status,
      selectedCustomerId,
      role === "technician" ? scope : "all",
      role === "technician"
    );
  }

  function applyFilter(status: string) {
    setStatusFilter(status);
    updateUrl(query, status, customerId);
    runSearch(query, status, customerId);
  }

  function handleScopeChange(next: TechnicianJobScope) {
    setScope(next);
    runSearch(query, statusFilter, customerId);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setCustomerId("");
    updateUrl(query, statusFilter, "");
    runSearch(query, statusFilter, "");
  }

  function selectCustomer(pick: CustomerPick) {
    setCustomerId(pick.id);
    updateUrl(query, statusFilter, pick.id);
    runSearch(query, statusFilter, pick.id);
  }

  const isTechnician = role === "technician";
  const showAmounts = role === "admin" || role === "reception";
  const apiSearchType =
    response?.mode === "jobs" ? response.searchType : null;
  const showCustomerHistory =
    response?.mode === "jobs" &&
    response.customer != null &&
    (apiSearchType === "mobile" || apiSearchType === "name");
  const showSingleJob =
    response?.mode === "jobs" &&
    response.searchType === "ut" &&
    response.jobs.length === 1;
  const jobs = response?.mode === "jobs" ? response.jobs : [];
  const customer = response?.mode === "jobs" ? response.customer : null;
  const totalVisits = response?.mode === "jobs" ? response.totalVisits : undefined;
  const customerPicks =
    response?.mode === "customer_pick" ? response.customers : [];
  const hasActiveSearch = Boolean(query.trim() || customerId);

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
          onChange={(e) => {
            setQuery(e.target.value);
            if (customerId) setCustomerId("");
          }}
          placeholder="UT number, mobile, or customer name"
          className="flex h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-lg placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          autoFocus
        />

        {hasActiveSearch && (
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
        )}

        <button
          type="submit"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Search
        </button>
      </form>

      {loading ? (
        <p className="text-center text-slate-500">Searching…</p>
      ) : customerPicks.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-slate-900">Select Customer</h3>
          <p className="mt-1 text-sm text-slate-600">
            Multiple customers match &ldquo;{query}&rdquo;. Select the correct one.
          </p>
          <div className="mt-3 space-y-2">
            {customerPicks.map((pick) => (
              <div
                key={pick.id}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => selectCustomer(pick)}
                  className="min-w-0 flex-1 text-left text-sm hover:text-emerald-800"
                >
                  <p className="font-medium text-slate-900">
                    {pick.name ?? "Unnamed"}
                  </p>
                  <p className="text-slate-600">{formatMobileDisplay(pick.mobile)}</p>
                  <span className="text-xs text-slate-500">
                    {pick.jobCount} job{pick.jobCount === 1 ? "" : "s"}
                  </span>
                </button>
                <CallCustomerButton mobile={pick.mobile} />
              </div>
            ))}
          </div>
        </div>
      ) : jobs.length === 0 ? (
        <p className="text-center text-slate-500">No jobs found</p>
      ) : showSingleJob ? (
        <JobListCard
          id={jobs[0].id}
          jobNumber={jobs[0].jobNumber}
          status={jobs[0].status}
          customerName={jobs[0].customer.name}
          mobile={jobs[0].customer.mobile}
          applianceLine={[jobs[0].brand, jobs[0].applianceType].filter(Boolean).join(" ")}
          serviceAmount={jobs[0].serviceAmount}
          showServiceAmount={showAmounts}
          meta={[
            `Received ${formatDateTime(jobs[0].receivedAt)}`,
            jobs[0].readyAt ? `Completed ${formatDateTime(jobs[0].readyAt)}` : null,
            jobs[0].deliveredAt ? `Delivered ${formatDateTime(jobs[0].deliveredAt)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      ) : showCustomerHistory && customer ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="font-semibold text-emerald-900">Customer Service History</h3>
          <div className="mt-2 flex items-start justify-between gap-2">
            <div className="space-y-1 text-sm text-emerald-800">
              <p>
                <span className="font-medium">Customer:</span>{" "}
                {customer.name ?? "—"}
              </p>
              <p>
                <span className="font-medium">Mobile:</span>{" "}
                {formatMobileDisplay(customer.mobile)}
              </p>
              <p>
                <span className="font-medium">Total Service Visits:</span>{" "}
                {totalVisits ?? jobs.length}
                {statusFilter !== "all" && jobs.length !== (totalVisits ?? jobs.length)
                  ? ` · showing ${jobs.length} filtered`
                  : ""}
                {isTechnician && scope === "my" ? " · your assigned jobs" : ""}
              </p>
            </div>
            <CallCustomerButton mobile={customer.mobile} />
          </div>
          <ServiceHistoryTable jobs={jobs} showAmounts={showAmounts} />
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
              serviceAmount={job.serviceAmount}
              meta={`Received ${formatDateTime(job.receivedAt)}`}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
