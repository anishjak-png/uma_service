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
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PendingJob = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand: string;
  complaint: string;
  receivedAt: string;
  assignedTechnician?: { name: string } | null;
  outsourcedTo?: { name: string } | null;
  customer: { mobile: string; name?: string | null };
};

type TechnicianStats = {
  pendingJobs: number;
  readyJobs: number;
  waitingApprovalJobs: number;
  returnJobs: number;
};

export default function PendingJobsPage() {
  const { role, loaded: roleLoaded } = useAuth();
  const [jobs, setJobs] = useState<PendingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TechnicianStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "Outsourced">("all");
  const { scope, setScope, ready: scopeReady } = useTechnicianJobScope();

  const loadJobs = useCallback(async (jobScope: "my" | "all", userRole: string | null) => {
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
            ACTIVE_STATUSES.includes(j.status as (typeof ACTIVE_STATUSES)[number])
          )
        : []
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!roleLoaded || role !== "technician") return;
    fetch("/api/technician/stats")
      .then((r) => r.json())
      .then(setStats);
  }, [role, roleLoaded]);

  useEffect(() => {
    if (!roleLoaded) return;
    if (role === "technician" && !scopeReady) return;
    loadJobs(role === "technician" ? scope : "all", role);
  }, [scope, scopeReady, role, roleLoaded, loadJobs]);

  const isTechnician = role === "technician";
  const outsourcedCount = jobs.filter((j) => j.status === "Outsourced").length;
  const displayedJobs =
    !isTechnician && statusFilter === "Outsourced"
      ? jobs.filter((j) => j.status === "Outsourced")
      : jobs;

  return (
    <AppShell>
      {!isTechnician && jobs.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusFilter === "all"
                ? "bg-emerald-600 text-white"
                : "border border-slate-300 bg-white text-slate-600"
            }`}
          >
            All ({jobs.length})
          </button>
          {outsourcedCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("Outsourced")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                statusFilter === "Outsourced"
                  ? "bg-purple-600 text-white"
                  : "border border-purple-200 bg-purple-50 text-purple-800"
              }`}
            >
              Outsourced ({outsourcedCount})
            </button>
          )}
        </div>
      )}

      {isTechnician && (
        <div className="mb-3">
          <TechnicianJobScopeToggle scope={scope} onChange={setScope} />
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : displayedJobs.length === 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="text-sm font-semibold text-emerald-800">
            {isTechnician && scope === "my"
              ? "No jobs assigned to you"
              : statusFilter === "Outsourced"
                ? "No outsourced jobs"
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
              applianceLine={[job.brand, job.applianceType].filter(Boolean).join(" ")}
              complaint={job.complaint}
              showServiceAmount={!isTechnician}
              meta={
                job.status === "Outsourced" && job.outsourcedTo
                  ? `With ${job.outsourcedTo.name}`
                  : !isTechnician && job.assignedTechnician
                    ? job.assignedTechnician.name
                    : undefined
              }
            />
          ))}
        </div>
      )}

      {isTechnician && stats && (
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

      {!isTechnician && !loading && displayedJobs.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {displayedJobs.length} active job{displayedJobs.length === 1 ? "" : "s"}
          {statusFilter === "Outsourced" ? " (outsourced)" : ""}
        </p>
      )}
    </AppShell>
  );
}
