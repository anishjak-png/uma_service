"use client";

import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import {
  TechnicianJobScopeToggle,
  useTechnicianJobScope,
} from "@/components/TechnicianJobScopeToggle";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/components/AuthProvider";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { formatDateTime } from "@/lib/jobs";
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
  assignedTechnician?: { name: string } | null;
  outsourcedTo?: { id: string; name: string } | null;
  isWarranty?: boolean;
  warrantyTakenAt?: string | null;
  customer: { mobile: string; name?: string | null };
};

type NamedOption = { id: string; name: string };

type StatusFilter = "all" | "Outsourced" | "Warranty";

type TechnicianStats = {
  pendingJobs: number;
  readyJobs: number;
  waitingApprovalJobs: number;
  returnJobs: number;
};

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
  const [stats, setStats] = useState<TechnicianStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilter);
  const [partnerFilter, setPartnerFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState(
    searchParams.get("warrantyBrand") ?? ""
  );
  const [partners, setPartners] = useState<NamedOption[]>([]);
  const [outsourcedTotal, setOutsourcedTotal] = useState(0);
  const [warrantyTotal, setWarrantyTotal] = useState(0);
  const { scope, setScope, ready: scopeReady } = useTechnicianJobScope();

  const loadJobs = useCallback(
    async (jobScope: "my" | "all", userRole: string | null) => {
      setLoading(true);
      const params = new URLSearchParams({ active: "true" });
      if (userRole === "technician") {
        params.set("scope", jobScope);
      }

      const res = await fetch(`/api/jobs?${params}`);
      const data = await res.json();
      setJobs(
        Array.isArray(data)
          ? data.filter((j: PendingJob) =>
              ACTIVE_STATUSES.includes(
                j.status as (typeof ACTIVE_STATUSES)[number]
              )
            )
          : []
      );
      setLoading(false);
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
    fetch("/api/jobs?status=Outsourced&scope=all")
      .then((r) => r.json())
      .then((data) => {
        setOutsourcedTotal(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => setOutsourcedTotal(0));
    fetch("/api/jobs?warranty=true&scope=all")
      .then((r) => r.json())
      .then((data) => {
        setWarrantyTotal(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => setWarrantyTotal(0));
  }, [roleLoaded, statusFilter]);

  useEffect(() => {
    if (!roleLoaded) return;
    if (role === "technician" && !scopeReady) return;
    const jobScope =
      role === "technician" &&
      statusFilter !== "Outsourced" &&
      statusFilter !== "Warranty"
        ? scope
        : "all";
    loadJobs(jobScope, role);
  }, [scope, scopeReady, role, roleLoaded, statusFilter, loadJobs]);

  const isTechnician = role === "technician";
  const outsourcedJobs = jobs.filter((j) => j.status === "Outsourced");
  const warrantyJobs = jobs.filter(
    (j) =>
      j.status === "WarrantyPending" || j.status === "WarrantyWithCompany"
  );
  const outsourcedCount =
    statusFilter === "Outsourced" ? outsourcedJobs.length : outsourcedTotal;
  const warrantyCount =
    statusFilter === "Warranty" ? warrantyJobs.length : warrantyTotal;

  const displayedJobs =
    statusFilter === "Outsourced"
      ? outsourcedJobs.filter(
          (j) => !partnerFilter || j.outsourcedTo?.id === partnerFilter
        )
      : statusFilter === "Warranty"
        ? warrantyJobs.filter(
            (j) => !brandFilter || j.brand === brandFilter
          )
        : jobs;

  const warrantyBrands = Array.from(
    new Set(warrantyJobs.map((j) => j.brand).filter(Boolean))
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
    if (!isTechnician && job.assignedTechnician) {
      return job.assignedTechnician.name;
    }
    return undefined;
  }

  return (
    <AppShell>
      {isTechnician && (
        <div className="mb-3">
          <TechnicianJobScopeToggle scope={scope} onChange={setScope} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setStatusFilter("all");
            setPartnerFilter("");
            setBrandFilter("");
          }}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            statusFilter === "all"
              ? "bg-emerald-600 text-white"
              : "border border-slate-300 bg-white text-slate-600"
          }`}
        >
          All ({jobs.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setStatusFilter("Warranty");
            setPartnerFilter("");
          }}
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
          onClick={() => {
            setStatusFilter("Outsourced");
            setBrandFilter("");
          }}
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
            onClick={() => setBrandFilter("")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              !brandFilter
                ? "bg-sky-600 text-white"
                : "bg-white text-sky-800 ring-1 ring-sky-200"
            }`}
          >
            All brands
          </button>
          {warrantyBrands.map((brandName) => {
            const count = warrantyJobs.filter((j) => j.brand === brandName).length;
            return (
              <button
                key={brandName}
                type="button"
                onClick={() => setBrandFilter(brandName)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  brandFilter === brandName
                    ? "bg-sky-600 text-white"
                    : "bg-sky-50 text-sky-800 ring-1 ring-sky-200"
                }`}
              >
                {brandName} ({count})
              </button>
            );
          })}
        </div>
      )}

      {statusFilter === "Outsourced" && partners.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setPartnerFilter("")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              !partnerFilter
                ? "bg-purple-600 text-white"
                : "bg-white text-purple-800 ring-1 ring-purple-200"
            }`}
          >
            All partners
          </button>
          {partners.map((partner) => {
            const count = outsourcedJobs.filter(
              (j) => j.outsourcedTo?.id === partner.id
            ).length;
            if (count === 0) return null;
            return (
              <button
                key={partner.id}
                type="button"
                onClick={() => setPartnerFilter(partner.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  partnerFilter === partner.id
                    ? "bg-purple-600 text-white"
                    : "bg-purple-50 text-purple-800 ring-1 ring-purple-200"
                }`}
              >
                {partner.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : displayedJobs.length === 0 ? (
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
          {displayedJobs.map((job) => (
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
              showServiceAmount={!isTechnician}
              emphasis={warrantyEmphasis(job)}
              meta={jobMeta(job)}
            />
          ))}
        </div>
      )}

      {isTechnician && stats && statusFilter === "all" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <StatCard
            label="Pending"
            value={stats.pendingJobs}
            valueClassName="text-blue-700"
          />
          <StatCard
            label="Ready"
            value={stats.readyJobs}
            valueClassName="text-emerald-700"
          />
          <StatCard
            label="Waiting"
            value={stats.waitingApprovalJobs}
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
          <StatCard label="Return" value={stats.returnJobs} />
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

      {!loading && displayedJobs.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {displayedJobs.length} job
          {displayedJobs.length === 1 ? "" : "s"}
          {statusFilter === "Outsourced"
            ? " (outsourced)"
            : statusFilter === "Warranty"
              ? " (warranty)"
              : ""}
        </p>
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
