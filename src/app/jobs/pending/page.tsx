"use client";

import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import {
  TechnicianJobScopeToggle,
  useTechnicianJobScope,
} from "@/components/TechnicianJobScopeToggle";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { useCallback, useEffect, useState } from "react";

type PendingJob = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand: string;
  complaint: string;
  receivedAt: string;
  serviceAmount?: number | null;
  assignedTechnician?: { name: string } | null;
  customer: { mobile: string; name?: string | null };
};

type TechnicianStats = {
  pendingJobs: number;
  readyJobs: number;
  deliveredThisMonth: number;
};

export default function PendingJobsPage() {
  const [jobs, setJobs] = useState<PendingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [stats, setStats] = useState<TechnicianStats | null>(null);
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
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setRole(data.role ?? null);
        setRoleLoaded(true);
        if (data.role === "technician") {
          fetch("/api/technician/stats")
            .then((r) => r.json())
            .then(setStats);
        }
      });
  }, []);

  useEffect(() => {
    if (!roleLoaded) return;
    if (role === "technician" && !scopeReady) return;
    loadJobs(role === "technician" ? scope : "all", role);
  }, [scope, scopeReady, role, roleLoaded, loadJobs]);

  const isTechnician = role === "technician";

  return (
    <AppShell>
      <PageHeader
        title={isTechnician ? "Technician Dashboard" : "Active Jobs"}
        description={
          isTechnician
            ? scope === "my"
              ? "Jobs assigned to you"
              : "All active jobs in the service centre"
            : "All pending and in-progress service jobs"
        }
      />

      {isTechnician && (
        <div className="mb-4">
          <TechnicianJobScopeToggle scope={scope} onChange={setScope} />
        </div>
      )}

      {loading ? (
        <p className="text-center text-slate-500">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="font-semibold text-emerald-800">
            {isTechnician && scope === "my"
              ? "No jobs assigned to you"
              : "No active jobs"}
          </p>
        </div>
      ) : (
        <div className="mb-6 space-y-2">
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
              meta={
                job.assignedTechnician
                  ? `Assigned: ${job.assignedTechnician.name}`
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {isTechnician && stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="My Pending Jobs"
            value={stats.pendingJobs}
            valueClassName="text-blue-700"
          />
          <StatCard
            label="My Ready Jobs"
            value={stats.readyJobs}
            valueClassName="text-emerald-700"
          />
          <StatCard
            label="My Delivered (This Month)"
            value={stats.deliveredThisMonth}
          />
        </div>
      )}
    </AppShell>
  );
}