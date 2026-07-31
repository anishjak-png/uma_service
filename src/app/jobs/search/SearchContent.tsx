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
  outsourcedTo?: { id: string; name: string } | null;
  isWarranty?: boolean;
  warrantyTakenAt?: string | null;
};

type PartnerOption = { id: string; name: string };

function isWarrantyJobStatus(status: string) {
  return status === "WarrantyPending" || status === "WarrantyWithCompany";
}

function isWarrantyFilter(status: string) {
  return status === "Warranty" || isWarrantyJobStatus(status);
}

function warrantyEmphasis(job: Pick<JobResult, "status" | "warrantyTakenAt">) {
  if (job.status === "WarrantyWithCompany") {
    return job.warrantyTakenAt
      ? `With company · ${formatDateTime(job.warrantyTakenAt)}`
      : "With company";
  }
  if (job.status === "WarrantyPending") return "At store";
  return undefined;
}

function normalizeStatusFilter(status: string, warrantyOnly: boolean) {
  if (warrantyOnly || isWarrantyFilter(status)) return "Warranty";
  return status;
}

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
  { value: "Warranty", label: "Warranty" },
  { value: "Outsourced", label: "Outsourced" },
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
  const initialOutsourcedToId = searchParams.get("outsourcedToId") ?? "";
  const initialWarrantyBrand = searchParams.get("warrantyBrand") ?? "";
  const initialWarrantyOnly = searchParams.get("warranty") === "true";

  const [query, setQuery] = useState(initialQ);
  const [statusFilter, setStatusFilter] = useState(
    normalizeStatusFilter(initialStatus, initialWarrantyOnly)
  );
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [partnerFilter, setPartnerFilter] = useState(initialOutsourcedToId);
  const [brandFilter, setBrandFilter] = useState(initialWarrantyBrand);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [warrantyBrands, setWarrantyBrands] = useState<string[]>([]);
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
        outsourcedToId?: string;
        warrantyBrand?: string;
        warranty?: boolean;
      } = {}
    ) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCustomerId) {
        params.set("customerId", selectedCustomerId);
      } else if (q.trim()) {
        params.set("q", q.trim());
      }
      if (status === "Warranty") {
        params.set("warranty", "true");
      } else if (status !== "all") {
        params.set("status", status);
      } else if (browse.warranty) {
        params.set("warranty", "true");
      }
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
      if (browse.outsourcedToId) {
        params.set("outsourcedToId", browse.outsourcedToId);
      }
      if (browse.warrantyBrand) {
        params.set("warrantyBrand", browse.warrantyBrand);
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
    outsourcedToId: partnerFilter || undefined,
    warrantyBrand: brandFilter || undefined,
    warranty: initialWarrantyOnly || undefined,
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
      initialCompletedBy ||
      partnerFilter ||
      brandFilter ||
      initialWarrantyOnly
  );

  useEffect(() => {
    if (!roleLoaded) return;
    if (statusFilter !== "Outsourced" && !initialOutsourcedToId) return;
    fetch("/api/outsource-partners")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPartners(data);
      })
      .catch(() => setPartners([]));
  }, [roleLoaded, statusFilter, initialOutsourcedToId]);

  useEffect(() => {
    if (!roleLoaded) return;
    if (role === "technician" && !scopeReady) return;

    const nextStatus = normalizeStatusFilter(initialStatus, initialWarrantyOnly);
    setQuery(initialQ);
    setStatusFilter(nextStatus);
    setCustomerId(initialCustomerId);
    setPartnerFilter(initialOutsourcedToId);
    setBrandFilter(initialWarrantyBrand);
    search(
      initialQ,
      nextStatus,
      initialCustomerId,
      role === "technician" ? scope : "all",
      role === "technician",
      {
        ...browseParams,
        outsourcedToId: initialOutsourcedToId || undefined,
        warrantyBrand: initialWarrantyBrand || undefined,
        warranty: initialWarrantyOnly || undefined,
      }
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
    initialOutsourcedToId,
    initialWarrantyBrand,
    initialWarrantyOnly,
    role,
    roleLoaded,
    scope,
    scopeReady,
    search,
  ]);

  useEffect(() => {
    if (statusFilter !== "Warranty") return;
    fetch("/api/jobs/search?warranty=true")
      .then((r) => r.json())
      .then((data) => {
        const list: JobResult[] = Array.isArray(data?.jobs) ? data.jobs : [];
        const brands = Array.from(
          new Set(
            list
              .map((j) => j.brand)
              .filter((b): b is string => typeof b === "string" && b.length > 0)
          )
        ).sort((a, b) => a.localeCompare(b));
        setWarrantyBrands(brands);
      })
      .catch(() => setWarrantyBrands([]));
  }, [statusFilter]);

  function updateUrl(
    q: string,
    status: string,
    selectedCustomerId: string,
    outsourcedToId: string = partnerFilter,
    warrantyBrand: string = brandFilter
  ) {
    const params = new URLSearchParams();
    if (selectedCustomerId) {
      params.set("customerId", selectedCustomerId);
      if (q.trim()) params.set("q", q.trim());
    } else if (q.trim()) {
      params.set("q", q.trim());
    }
    if (status === "Warranty") {
      params.set("warranty", "true");
    } else if (status !== "all") {
      params.set("status", status);
    }
    if (initialTechnicianId) params.set("technicianId", initialTechnicianId);
    if (initialApplianceType) params.set("applianceType", initialApplianceType);
    if (initialBrand) params.set("brand", initialBrand);
    if (initialMinAgeDays) params.set("minAgeDays", initialMinAgeDays);
    if (initialActive) params.set("active", "true");
    if (initialReceivedPeriod) params.set("receivedPeriod", initialReceivedPeriod);
    if (initialDeliveredPeriod) params.set("deliveredPeriod", initialDeliveredPeriod);
    if (initialReadyPeriod) params.set("readyPeriod", initialReadyPeriod);
    if (initialCompletedBy) params.set("completedByTechnicianId", initialCompletedBy);
    if (status === "Outsourced" && outsourcedToId) {
      params.set("outsourcedToId", outsourcedToId);
    }
    if (status === "Warranty" && warrantyBrand) {
      params.set("warrantyBrand", warrantyBrand);
    }
    router.replace(`/jobs/search?${params.toString()}`, { scroll: false });
  }

  function runSearch(
    q: string,
    status: string,
    selectedCustomerId: string = customerId,
    outsourcedToId: string = partnerFilter,
    warrantyBrand: string = brandFilter
  ) {
    search(
      q,
      status,
      selectedCustomerId,
      role === "technician" ? scope : "all",
      role === "technician",
      {
        ...browseParams,
        outsourcedToId:
          status === "Outsourced" ? outsourcedToId || undefined : undefined,
        warrantyBrand:
          status === "Warranty" ? warrantyBrand || undefined : undefined,
        warranty: status === "Warranty" || undefined,
      }
    );
  }

  function applyFilter(status: string) {
    const nextPartner = status === "Outsourced" ? partnerFilter : "";
    const nextBrand = status === "Warranty" ? brandFilter : "";
    setStatusFilter(status);
    setPartnerFilter(nextPartner);
    setBrandFilter(nextBrand);
    updateUrl(query, status, customerId, nextPartner, nextBrand);
    runSearch(query, status, customerId, nextPartner, nextBrand);
  }

  function applyPartnerFilter(partnerId: string) {
    setPartnerFilter(partnerId);
    setStatusFilter("Outsourced");
    updateUrl(query, "Outsourced", customerId, partnerId, "");
    runSearch(query, "Outsourced", customerId, partnerId, "");
  }

  function applyBrandFilter(brandName: string) {
    setBrandFilter(brandName);
    setStatusFilter("Warranty");
    updateUrl(query, "Warranty", customerId, "", brandName);
    runSearch(query, "Warranty", customerId, "", brandName);
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

      {(hasActiveSearch || Boolean(role)) && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {hasBrowseFilter && !query.trim() && !customerId ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              Report filter — tap a job to open
            </span>
          ) : null}
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            const outsourced = f.value === "Outsourced";
            const warranty = f.value === "Warranty";
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => applyFilter(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? outsourced
                      ? "bg-purple-600 text-white"
                      : warranty
                        ? "bg-sky-600 text-white"
                        : "bg-emerald-600 text-white"
                    : outsourced
                      ? "bg-purple-50 text-purple-800 ring-1 ring-purple-200 hover:bg-purple-100"
                      : warranty
                        ? "bg-sky-50 text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {statusFilter === "Warranty" && warrantyBrands.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => applyBrandFilter("")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              !brandFilter
                ? "bg-sky-600 text-white"
                : "bg-white text-sky-800 ring-1 ring-sky-200"
            }`}
          >
            All brands
          </button>
          {warrantyBrands.map((brandName) => (
            <button
              key={brandName}
              type="button"
              onClick={() => applyBrandFilter(brandName)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                brandFilter === brandName
                  ? "bg-sky-600 text-white"
                  : "bg-sky-50 text-sky-800 ring-1 ring-sky-200"
              }`}
            >
              {brandName}
            </button>
          ))}
        </div>
      )}

      {statusFilter === "Outsourced" && partners.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => applyPartnerFilter("")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              !partnerFilter
                ? "bg-purple-600 text-white"
                : "bg-white text-purple-800 ring-1 ring-purple-200"
            }`}
          >
            All partners
          </button>
          {partners.map((partner) => (
            <button
              key={partner.id}
              type="button"
              onClick={() => applyPartnerFilter(partner.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                partnerFilter === partner.id
                  ? "bg-purple-600 text-white"
                  : "bg-purple-50 text-purple-800 ring-1 ring-purple-200"
              }`}
            >
              {partner.name}
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
          emphasis={warrantyEmphasis(jobs[0])}
          meta={[
            isWarrantyJobStatus(jobs[0].status) && jobs[0].brand
              ? jobs[0].brand
              : null,
            jobs[0].status === "Outsourced" && jobs[0].outsourcedTo
              ? `With ${jobs[0].outsourcedTo.name}`
              : null,
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
              emphasis={warrantyEmphasis(job)}
              meta={[
                isWarrantyJobStatus(job.status) && job.brand
                  ? job.brand
                  : null,
                job.status === "Outsourced" && job.outsourcedTo
                  ? `With ${job.outsourcedTo.name}`
                  : null,
                `Received ${formatDateTime(job.receivedAt)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
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
              emphasis={warrantyEmphasis(job)}
              meta={[
                isWarrantyJobStatus(job.status) && job.brand
                  ? job.brand
                  : null,
                job.status === "Outsourced" && job.outsourcedTo
                  ? `With ${job.outsourcedTo.name}`
                  : null,
                `Received ${formatDateTime(job.receivedAt)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
