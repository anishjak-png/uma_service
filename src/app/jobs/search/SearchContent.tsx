"use client";

import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import {
  TechnicianJobScopeToggle,
  useTechnicianJobScope,
  type TechnicianJobScope,
} from "@/components/TechnicianJobScopeToggle";
import { useAuth } from "@/components/AuthProvider";
import { CallCustomerButton } from "@/components/CallCustomerButton";
import { formatMobileDisplay, formatDateTime } from "@/lib/jobs";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type JobResult = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand?: string | null;
  complaint?: string;
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
      searchType: "empty" | "mobile" | "ut" | "name" | "browse";
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
  { value: "WaitingForCustomerApproval", label: "Waiting" },
  { value: "Ready", label: "Ready" },
  { value: "Return", label: "Return" },
  { value: "Delivered", label: "Delivered" },
] as const;

export default function SearchContent() {
  const router = useRouter();
  const { role, loaded: roleLoaded } = useAuth();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const initialStatus = searchParams.get("status") ?? "all";
  const initialCustomerId = searchParams.get("customerId") ?? "";
  const initialTechnicianId = searchParams.get("technicianId") ?? "";
  const initialApplianceType = searchParams.get("applianceType") ?? "";
  const initialBrand = searchParams.get("brand") ?? "";
  const initialMinAgeDays = searchParams.get("minAgeDays") ?? "";
  const initialActive = searchParams.get("active") === "true";
  const initialReceivedPeriod = searchParams.get("receivedPeriod") ?? "";
  const initialDeliveredPeriod = searchParams.get("deliveredPeriod") ?? "";
  const initialReadyPeriod = searchParams.get("readyPeriod") ?? "";
  const initialCompletedBy = searchParams.get("completedByTechnicianId") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { scope, setScope, ready: scopeReady } = useTechnicianJobScope();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (
      q: string,
      status: string,
      selectedCustomerId: string,
      jobScope: TechnicianJobScope,
      isTechnician: boolean,
      browse: {
        technicianId?: string;
        applianceType?: string;
        brand?: string;
        minAgeDays?: string;
        active?: boolean;
        receivedPeriod?: string;
        deliveredPeriod?: string;
        readyPeriod?: string;
        completedByTechnicianId?: string;
      } = {}
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
      if (browse.technicianId) params.set("technicianId", browse.technicianId);
      if (browse.applianceType) params.set("applianceType", browse.applianceType);
      if (browse.brand) params.set("brand", browse.brand);
      if (browse.minAgeDays) params.set("minAgeDays", browse.minAgeDays);
      if (browse.active) params.set("active", "true");
      if (browse.receivedPeriod) params.set("receivedPeriod", browse.receivedPeriod);
      if (browse.deliveredPeriod) params.set("deliveredPeriod", browse.deliveredPeriod);
      if (browse.readyPeriod) params.set("readyPeriod", browse.readyPeriod);
      if (browse.completedByTechnicianId) {
        params.set("completedByTechnicianId", browse.completedByTechnicianId);
      }

      const res = await fetch(`/api/jobs/search?${params}`);
      const data = await res.json();
      setResponse(data);
      setLoading(false);
    },
    []
  );

  const browseParams = {
    technicianId: initialTechnicianId || undefined,
    applianceType: initialApplianceType || undefined,
    brand: initialBrand || undefined,
    minAgeDays: initialMinAgeDays || undefined,
    active: initialActive || undefined,
    receivedPeriod: initialReceivedPeriod || undefined,
    deliveredPeriod: initialDeliveredPeriod || undefined,
    readyPeriod: initialReadyPeriod || undefined,
    completedByTechnicianId: initialCompletedBy || undefined,
  };

  const hasBrowseFilter = Boolean(
    initialStatus !== "all" ||
      initialTechnicianId ||
      initialApplianceType ||
      initialBrand ||
      initialMinAgeDays ||
      initialActive ||
      initialReceivedPeriod ||
      initialDeliveredPeriod ||
      initialReadyPeriod ||
      initialCompletedBy
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
      role === "technician",
      browseParams
    );
  }, [
    initialQ,
    initialStatus,
    initialCustomerId,
    initialTechnicianId,
    initialApplianceType,
    initialBrand,
    initialMinAgeDays,
    initialActive,
    initialReceivedPeriod,
    initialDeliveredPeriod,
    initialReadyPeriod,
    initialCompletedBy,
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
    if (initialTechnicianId) params.set("technicianId", initialTechnicianId);
    if (initialApplianceType) params.set("applianceType", initialApplianceType);
    if (initialBrand) params.set("brand", initialBrand);
    if (initialMinAgeDays) params.set("minAgeDays", initialMinAgeDays);
    if (initialActive) params.set("active", "true");
    if (initialReceivedPeriod) params.set("receivedPeriod", initialReceivedPeriod);
    if (initialDeliveredPeriod) params.set("deliveredPeriod", initialDeliveredPeriod);
    if (initialReadyPeriod) params.set("readyPeriod", initialReadyPeriod);
    if (initialCompletedBy) params.set("completedByTechnicianId", initialCompletedBy);
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
      role === "technician",
      browseParams
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

  function handleQueryChange(value: string) {
    setQuery(value);
    if (customerId) setCustomerId("");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateUrl(value, statusFilter, "");
      runSearch(value, statusFilter, "");
    }, 350);
  }

  function selectCustomer(pick: CustomerPick) {
    setCustomerId(pick.id);
    updateUrl(query, statusFilter, pick.id);
    runSearch(query, statusFilter, pick.id);
  }

  const isTechnician = role === "technician";
  const showAmounts = role === "admin";
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
  const hasActiveSearch = Boolean(query.trim() || customerId || hasBrowseFilter);

  return (
    <AppShell>
      {isTechnician && (
        <div className="mb-3">
          <TechnicianJobScopeToggle scope={scope} onChange={handleScopeChange} />
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="UT number, mobile, or name"
        className="mb-3 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-base placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        autoFocus
      />

      {hasActiveSearch && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {hasBrowseFilter && !query.trim() && !customerId ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              Report filter — tap a job to open
            </span>
          ) : null}
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => applyFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
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

      {loading ? (
        <p className="text-center text-sm text-slate-500">Searching…</p>
      ) : customerPicks.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Multiple matches — select customer
          </p>
          {customerPicks.map((pick) => (
            <div
              key={pick.id}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2.5"
            >
              <button
                type="button"
                onClick={() => selectCustomer(pick)}
                className="min-w-0 flex-1 text-left text-sm hover:text-emerald-800"
              >
                <p className="font-medium text-slate-900">
                  {pick.name ?? "Unnamed"}
                </p>
                <p className="text-xs text-slate-600">
                  {formatMobileDisplay(pick.mobile)} · {pick.jobCount} job
                  {pick.jobCount === 1 ? "" : "s"}
                </p>
              </button>
              <CallCustomerButton mobile={pick.mobile} />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <p className="text-center text-sm text-slate-500">No jobs found</p>
      ) : showSingleJob ? (
        <JobListCard
          id={jobs[0].id}
          jobNumber={jobs[0].jobNumber}
          status={jobs[0].status}
          customerName={jobs[0].customer.name}
          mobile={jobs[0].customer.mobile}
          applianceLine={[jobs[0].brand, jobs[0].applianceType].filter(Boolean).join(" ")}
          complaint={jobs[0].complaint}
          serviceAmount={jobs[0].serviceAmount}
          showServiceAmount={showAmounts}
          meta={[
            `Received ${formatDateTime(jobs[0].receivedAt)}`,
            jobs[0].readyAt ? `Done ${formatDateTime(jobs[0].readyAt)}` : null,
            jobs[0].deliveredAt ? `Delivered ${formatDateTime(jobs[0].deliveredAt)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      ) : showCustomerHistory && customer ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2">
            <div className="min-w-0 text-sm">
              <p className="truncate font-semibold text-emerald-900">
                {customer.name ?? formatMobileDisplay(customer.mobile)}
              </p>
              <p className="text-xs text-emerald-800">
                {totalVisits ?? jobs.length} visit
                {(totalVisits ?? jobs.length) === 1 ? "" : "s"}
                {statusFilter !== "all" && jobs.length !== (totalVisits ?? jobs.length)
                  ? ` · ${jobs.length} shown`
                  : ""}
              </p>
            </div>
            <CallCustomerButton mobile={customer.mobile} />
          </div>
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
              serviceAmount={job.serviceAmount}
              showServiceAmount={showAmounts}
              meta={`Received ${formatDateTime(job.receivedAt)}`}
            />
          ))}
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
              serviceAmount={job.serviceAmount}
              showServiceAmount={showAmounts}
              meta={`Received ${formatDateTime(job.receivedAt)}`}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
