"use client";

import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import {
  JobListPagination,
  JOBS_PAGE_SIZE,
} from "@/components/JobListPagination";
import {
  TechnicianJobScopeToggle,
  useTechnicianJobScope,
} from "@/components/TechnicianJobScopeToggle";
import { TechnicianJobTracker } from "@/components/TechnicianJobTracker";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/components/AuthProvider";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { formatDateTime, formatDoneDatestamp } from "@/lib/jobs";
import {
  jobAssigneeName,
  shouldShowJobAssignee,
} from "@/lib/job-assignee-display";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";

type PendingJob = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand: string;
  complaint: string;
  receivedAt: string;
  readyAt?: string | null;
  serviceAmount?: number | null;
  assignedTechnician?: { name: string } | null;
  outsourcedTo?: { id: string; name: string } | null;
  isWarranty?: boolean;
  warrantyTakenAt?: string | null;
  customer: { mobile: string; name?: string | null };
};

type NamedOption = { id: string; name: string };

type StatusFilter = "all" | "Outsourced" | "Warranty";

type TechnicianStats = {
  receivedTotal: number;
  pending: number;
  pendingJobs: number;
  waitingApprovalJobs: number;
  attended: number;
  readyJobs: number;
  returnJobs: number;
  delivered: number;
};

type PaginatedJobsResponse = {
  items: PendingJob[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function parseActiveJobs(items: PendingJob[]): PendingJob[] {
  return items.filter((j) =>
    ACTIVE_STATUSES.includes(j.status as (typeof ACTIVE_STATUSES)[number])
  );
}

function PendingJobsContent() {
  const { role, loaded: roleLoaded } = useAuth();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const initialFilter: StatusFilter =
    initialStatus === "Outsourced"
      ? "Outsourced"
      : initialStatus === "WarrantyPending" ||
          initialStatus === "WarrantyWithCompany" ||
          searchParams.get("warranty") === "true"
        ? "Warranty"
        : "all";

  const [jobs, setJobs] = useState<PendingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<TechnicianStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilter);
  const [partnerFilter, setPartnerFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState(
    searchParams.get("warrantyBrand") ?? ""
  );
  const [partners, setPartners] = useState<NamedOption[]>([]);
  const [outsourcedTotal, setOutsourcedTotal] = useState(0);
  const [warrantyTotal, setWarrantyTotal] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const { scope, setScope, ready: scopeReady } = useTechnicianJobScope();

  useEffect(() => {
    const urlScope = searchParams.get("scope");
    if (urlScope === "my" || urlScope === "all") {
      setScope(urlScope);
    }
  }, [searchParams, setScope]);

  const loadJobs = useCallback(
    async (
      pageNumber: number,
      userRole: string | null,
      jobScope: "my" | "all",
      filter: StatusFilter,
      partnerId: string,
      brand: string
    ) => {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(pageNumber),
        limit: String(JOBS_PAGE_SIZE),
      });

      if (filter === "Outsourced") {
        params.set("status", "Outsourced");
        if (userRole === "technician") params.set("scope", "all");
        if (partnerId) params.set("outsourcedToId", partnerId);
      } else if (filter === "Warranty") {
        params.set("warranty", "true");
        if (userRole === "technician") params.set("scope", "all");
        if (brand) params.set("warrantyBrand", brand);
      } else {
        params.set("active", "true");
        if (userRole === "technician") {
          params.set("scope", jobScope);
        }
      }

      try {
        const res = await fetch(`/api/jobs?${params}`);
        const data = (await res.json().catch(() => null)) as
          | PaginatedJobsResponse
          | { error?: string }
          | null;

        if (!res.ok || !data || !("items" in data)) {
          console.error(
            "[pending jobs]",
            data && "error" in data ? data.error : res.status
          );
          setJobs([]);
          setTotal(0);
          setTotalPages(1);
          return;
        }

        setJobs(parseActiveJobs(data.items));
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!roleLoaded || role !== "technician") return;
    fetch("/api/technician/stats")
      .then((r) => r.json())
      .then(setStats);
  }, [role, roleLoaded]);

  useEffect(() => {
    if (!roleLoaded) return;
    fetch("/api/outsource-partners")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPartners(data);
      })
      .catch(() => setPartners([]));
  }, [roleLoaded]);

  useEffect(() => {
    if (!roleLoaded) return;
    if (role === "technician" && !scopeReady) return;

    async function loadTabTotal(query: string, setter: (n: number) => void) {
      const res = await fetch(`/api/jobs?${query}`);
      const data = (await res.json().catch(() => null)) as PaginatedJobsResponse | null;
      if (data && "total" in data) {
        setter(data.total);
      }
    }

    const activeQuery = new URLSearchParams({
      active: "true",
      page: "1",
      limit: "1",
    });
    if (role === "technician") {
      activeQuery.set("scope", scope);
    }

    void loadTabTotal(activeQuery.toString(), setActiveTotal);
    void loadTabTotal(
      "status=Outsourced&scope=all&page=1&limit=1",
      setOutsourcedTotal
    );
    void loadTabTotal(
      "warranty=true&scope=all&page=1&limit=1",
      setWarrantyTotal
    );
  }, [roleLoaded, role, scope, scopeReady]);

  useEffect(() => {
    if (!roleLoaded) return;
    if (role === "technician" && !scopeReady) return;

    void loadJobs(page, role, scope, statusFilter, partnerFilter, brandFilter);
  }, [
    page,
    scope,
    scopeReady,
    role,
    roleLoaded,
    statusFilter,
    partnerFilter,
    brandFilter,
    loadJobs,
  ]);

  function changeStatusFilter(next: StatusFilter) {
    setStatusFilter(next);
    setPage(1);
    if (next === "all") {
      setPartnerFilter("");
      setBrandFilter("");
    } else if (next === "Warranty") {
      setPartnerFilter("");
    } else if (next === "Outsourced") {
      setBrandFilter("");
    }
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const isTechnician = role === "technician";
  const allTabTotal = statusFilter === "all" ? total : activeTotal;
  const outsourcedCount =
    statusFilter === "Outsourced" ? total : outsourcedTotal;
  const warrantyCount = statusFilter === "Warranty" ? total : warrantyTotal;

  const warrantyBrands = Array.from(
    new Set(jobs.map((j) => j.brand).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  function warrantyEmphasis(job: PendingJob) {
    if (job.status === "WarrantyWithCompany") {
      return job.warrantyTakenAt
        ? `With company · ${formatDateTime(job.warrantyTakenAt)}`
        : "With company";
    }
    if (job.status === "WarrantyPending") return "At store";
    return undefined;
  }

  function jobMeta(job: PendingJob) {
    if (
      job.status === "WarrantyPending" ||
      job.status === "WarrantyWithCompany"
    ) {
      return job.brand || undefined;
    }
    if (job.status === "Outsourced" && job.outsourcedTo) {
      return `With ${job.outsourcedTo.name}`;
    }
    return undefined;
  }

  function buildPendingMeta(job: PendingJob) {
    return [
      jobMeta(job),
      `Received ${formatDateTime(job.receivedAt)}`,
      formatDoneDatestamp(job.readyAt),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function shouldShowAssignee(job: PendingJob) {
    return shouldShowJobAssignee(
      job.status,
      role as "admin" | "reception" | "technician" | null,
      scope
    );
  }

  return (
    <AppShell>
      {isTechnician && scope === "my" && stats && statusFilter === "all" && (
        <TechnicianJobTracker stats={stats} />
      )}

      {isTechnician && (
        <div className="mb-3">
          <TechnicianJobScopeToggle
            scope={scope}
            onChange={(next) => {
              setScope(next);
              setPage(1);
            }}
          />
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => changeStatusFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            statusFilter === "all"
              ? "bg-emerald-600 text-white"
              : "border border-slate-300 bg-white text-slate-600"
          }`}
        >
          All ({statusFilter === "all" ? total : allTabTotal})
        </button>
        <button
          type="button"
          onClick={() => changeStatusFilter("Warranty")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            statusFilter === "Warranty"
              ? "bg-sky-600 text-white"
              : "border border-sky-200 bg-sky-50 text-sky-800"
          }`}
        >
          Warranty ({warrantyCount})
        </button>
        <button
          type="button"
          onClick={() => changeStatusFilter("Outsourced")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            statusFilter === "Outsourced"
              ? "bg-purple-600 text-white"
              : "border border-purple-200 bg-purple-50 text-purple-800"
          }`}
        >
          Outsourced ({outsourcedCount})
        </button>
      </div>

      {statusFilter === "Warranty" && warrantyBrands.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setBrandFilter("");
              setPage(1);
            }}
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
              onClick={() => {
                setBrandFilter(brandName);
                setPage(1);
              }}
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
            onClick={() => {
              setPartnerFilter("");
              setPage(1);
            }}
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
              onClick={() => {
                setPartnerFilter(partner.id);
                setPage(1);
              }}
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
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="text-sm font-semibold text-emerald-800">
            {isTechnician && scope === "my" && statusFilter === "all"
              ? "No jobs assigned to you"
              : statusFilter === "Outsourced"
                ? "No outsourced jobs"
                : statusFilter === "Warranty"
                  ? "No warranty jobs"
                  : "No active jobs"}
          </p>
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
              applianceLine={[job.brand, job.applianceType]
                .filter(Boolean)
                .join(" ")}
              complaint={job.complaint}
              serviceAmount={job.serviceAmount}
              showServiceAmount={!isTechnician}
              emphasis={warrantyEmphasis(job)}
              showAssignee={shouldShowAssignee(job)}
              assigneeName={jobAssigneeName(job.assignedTechnician)}
              meta={buildPendingMeta(job)}
            />
          ))}
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <JobListPagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={changePage}
        />
      )}

      {isTechnician && stats && statusFilter === "all" && scope === "all" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <StatCard
            label="Pending"
            value={stats.pendingJobs}
            href="/jobs/search?status=Pending&scope=my"
            valueClassName="text-blue-700"
          />
          <StatCard
            label="Ready"
            value={stats.readyJobs}
            href="/jobs/search?status=Ready&scope=my"
            valueClassName="text-emerald-700"
          />
          <StatCard
            label="Waiting"
            value={stats.waitingApprovalJobs}
            href="/jobs/search?status=WaitingForCustomerApproval&scope=my"
            valueClassName="text-amber-700"
          />
          <StatCard
            label="Warranty"
            value={warrantyCount}
            href="/jobs/search?warranty=true"
            valueClassName="text-sky-700"
          />
          <StatCard
            label="Outsourced"
            value={outsourcedCount}
            href="/jobs/search?status=Outsourced"
            valueClassName="text-purple-700"
          />
          <StatCard
            label="Return"
            value={stats.returnJobs}
            href="/jobs/search?status=Return&scope=my"
            valueClassName="text-orange-700"
          />
        </div>
      )}

      {isTechnician && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/jobs/search"
            className="rounded-md border border-slate-300 bg-white py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Search
          </Link>
          <Link
            href={jobs[0] ? `/jobs/${jobs[0].id}` : "/jobs/search"}
            className="rounded-md bg-emerald-600 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Update Status
          </Link>
        </div>
      )}
    </AppShell>
  );
}

export default function PendingJobsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="text-center text-sm text-slate-500">Loading…</p>
        </AppShell>
      }
    >
      <PendingJobsContent />
    </Suspense>
  );
}
