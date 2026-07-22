"use client";

import { AppShell } from "@/components/AppShell";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { ReceiptActions } from "@/components/ReceiptActions";
import {
  getSelectableStatuses,
  isDeliveredTerminal,
  STATUS_LABELS,
  type JobStatusValue,
  type StaffRole,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/currency";
import { daysSince, formatMobileDisplay, formatStatusChangedBy, parseProductPhotos } from "@/lib/jobs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type JobDetail = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand: string;
  model?: string | null;
  complaint: string;
  physicalCondition?: string | null;
  productPhotos?: string | null;
  remarks?: string | null;
  serviceAmount?: number | null;
  receivedAt: string;
  readyAt?: string | null;
  deliveredAt?: string | null;
  assignedTechnician?: { id: string; name: string } | null;
  completedByTechnician?: { id: string; name: string } | null;
  customer: { mobile: string; name?: string | null };
  statusHistory: Array<{
    id: string;
    status: string;
    note?: string | null;
    changedBy?: string | null;
    changedAt: string;
  }>;
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [readyAmount, setReadyAmount] = useState("");
  const [readyCompletedById, setReadyCompletedById] = useState("");
  const [showReadyForm, setShowReadyForm] = useState(false);
  const [showAmountEdit, setShowAmountEdit] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [technicians, setTechnicians] = useState<Array<{ id: string; name: string }>>([]);
  const [editCompletedById, setEditCompletedById] = useState("");
  const [showCompletedByEdit, setShowCompletedByEdit] = useState(false);

  const fetchJob = useCallback(async () => {
    const [jobRes, meRes] = await Promise.all([
      fetch(`/api/jobs/${id}`),
      fetch("/api/auth/me"),
    ]);

    if (!jobRes.ok) {
      router.push("/jobs/pending");
      return;
    }

    const data = await jobRes.json();
    const me = await meRes.json();
    setJob(data);
    setRole(me.role ?? null);
    setRemarks(data.remarks ?? "");
    setReadyAmount(data.serviceAmount != null ? String(data.serviceAmount) : "");
    setEditAmount(data.serviceAmount != null ? String(data.serviceAmount) : "");
    setEditCompletedById(data.completedByTechnician?.id ?? "");
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    if (role === "reception" || role === "admin") {
      fetch("/api/technicians")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setTechnicians(data);
        });
    }
  }, [role]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  async function updateJob(updates: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      setJob(data);
      setRemarks(data.remarks ?? "");
      setShowReadyForm(false);
      setShowAmountEdit(false);
    } else {
      const data = await res.json();
      alert(data.error ?? "Update failed");
    }
    setSaving(false);
  }

  async function handleStatusChange(status: string) {
    if (status === "Ready") {
      if (job?.readyAt && role !== "admin") {
        await updateJob({ status: "Ready" });
        return;
      }
      setReadyCompletedById(job?.assignedTechnician?.id ?? "");
      setShowReadyForm(true);
      return;
    }
    if (status === "Return") {
      await updateJob({ status, serviceAmount: 0 });
      return;
    }
    await updateJob({ status });
  }

  async function confirmReady() {
    const amount = Number(readyAmount);
    if (Number.isNaN(amount) || amount < 0) {
      alert("Enter a valid service amount");
      return;
    }
    const updates: Record<string, unknown> = {
      status: "Ready",
      serviceAmount: amount,
    };
    if (
      (role === "reception" || role === "admin") &&
      !job?.completedByTechnician
    ) {
      if (!readyCompletedById) {
        alert("Select the technician who completed the repair");
        return;
      }
      updates.completedByTechnicianId = readyCompletedById;
    }
    await updateJob(updates);
  }

  async function handleSaveRemarks() {
    await updateJob({ remarks });
  }

  async function handleSaveAmount() {
    const amount = Number(editAmount);
    if (Number.isNaN(amount) || amount < 0) {
      alert("Enter a valid service amount");
      return;
    }
    await updateJob({ serviceAmount: amount });
  }

  async function handleSaveCompletedBy() {
    await updateJob({
      completedByTechnicianId: editCompletedById || null,
    });
    setShowCompletedByEdit(false);
  }

  if (loading || !job) {
    return (
      <AppShell>
        <p className="text-center text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  const staffRole = role ?? "technician";
  const selectableStatuses = getSelectableStatuses(
    job.status as JobStatusValue,
    staffRole
  );
  const backHref = role === "technician" ? "/jobs/pending" : "/jobs/search";
  const photos = parseProductPhotos(job.productPhotos);
  const isStaff = role === "reception" || role === "admin";
  const isAdmin = role === "admin";
  const isLocked = isDeliveredTerminal(job.status) && !isAdmin;
  const canAdminEditAmount = isAdmin && job.readyAt != null && !isLocked;

  return (
    <AppShell>
      <div className="space-y-4">
        <Link href={backHref} className="text-sm font-medium text-emerald-600 hover:underline">
          ← Back
        </Link>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{job.jobNumber}</h2>
              <p className="text-slate-600">
                {job.customer.name ?? formatMobileDisplay(job.customer.mobile)}
              </p>
              <p className="text-sm text-slate-500">
                {formatMobileDisplay(job.customer.mobile)}
              </p>
            </div>
            <JobStatusBadge status={job.status} />
          </div>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="font-medium text-slate-700">Current status:</span>{" "}
              <JobStatusBadge status={job.status} />
            </p>
            {job.serviceAmount != null && (
              <p>
                <span className="font-medium text-slate-700">Service amount:</span>{" "}
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(job.serviceAmount)}
                </span>
                {job.readyAt && !isAdmin && (
                  <span className="ml-2 text-xs text-slate-400">(locked)</span>
                )}
              </p>
            )}
            <p>
              <span className="font-medium text-slate-700">Received date:</span>{" "}
              {new Date(job.receivedAt).toLocaleDateString("en-IN")} (
              {daysSince(new Date(job.receivedAt))} days ago)
            </p>
            {job.deliveredAt && (
              <p>
                <span className="font-medium text-slate-700">Delivered date:</span>{" "}
                {new Date(job.deliveredAt).toLocaleDateString("en-IN")}
              </p>
            )}
            <p>
              <span className="font-medium text-slate-700">Assigned technician:</span>{" "}
              {job.assignedTechnician?.name ?? "—"}
            </p>
            <p>
              <span className="font-medium text-slate-700">Completed by:</span>{" "}
              {job.completedByTechnician?.name ?? "—"}
            </p>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="font-medium text-slate-700">Product:</span>{" "}
              {[job.brand, job.applianceType, job.model].filter(Boolean).join(" ")}
            </p>
            <p>
              <span className="font-medium text-slate-700">Complaint:</span> {job.complaint}
            </p>
            {job.physicalCondition && (
              <p>
                <span className="font-medium text-slate-700">Condition:</span>{" "}
                {job.physicalCondition}
              </p>
            )}
            {job.readyAt && (
              <p>
                <span className="font-medium text-slate-700">Ready:</span>{" "}
                {new Date(job.readyAt).toLocaleDateString("en-IN")}
              </p>
            )}
          </div>

          {photos.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {photos.map((photo, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={photo}
                  alt={`Product ${i + 1}`}
                  className="h-24 w-24 rounded-md border border-slate-200 object-cover"
                />
              ))}
            </div>
          )}
        </div>

        {isLocked && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            This job is delivered and locked. Only admin can reopen it.
          </div>
        )}

        {canAdminEditAmount && !showAmountEdit && (
          <button
            type="button"
            onClick={() => setShowAmountEdit(true)}
            className="w-full rounded-md border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit Service Amount (Admin)
          </button>
        )}

        {isAdmin && job.readyAt && !showCompletedByEdit && (
          <button
            type="button"
            onClick={() => setShowCompletedByEdit(true)}
            className="w-full rounded-md border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit Completed By (Admin)
          </button>
        )}

        {showCompletedByEdit && isAdmin && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-900">Edit Completed By</h3>
            <select
              value={editCompletedById}
              onChange={(e) => setEditCompletedById(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <option value="">Not set</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleSaveCompletedBy}
                disabled={saving}
                className="flex-1 rounded-md bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setShowCompletedByEdit(false)}
                className="flex-1 rounded-md border border-slate-300 bg-white py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showAmountEdit && isAdmin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm space-y-3">
            <h3 className="font-semibold text-amber-900">Edit Service Amount</h3>
            <input
              type="number"
              min="0"
              step="1"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveAmount}
                disabled={saving}
                className="flex-1 rounded-md bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Save Amount
              </button>
              <button
                onClick={() => setShowAmountEdit(false)}
                className="flex-1 rounded-md border border-slate-300 bg-white py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showReadyForm && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 shadow-sm space-y-3">
            <h3 className="font-semibold text-emerald-900">Mark as Ready</h3>
            <p className="text-sm text-emerald-800">Service amount is required.</p>
            <input
              type="number"
              min="0"
              step="1"
              value={readyAmount}
              onChange={(e) => setReadyAmount(e.target.value)}
              placeholder="Amount in Rs."
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              autoFocus
            />
            {isStaff && !job.completedByTechnician && (
              <div>
                <label className="mb-1 block text-sm font-medium text-emerald-900">
                  Completed by (required)
                </label>
                <select
                  value={readyCompletedById}
                  onChange={(e) => setReadyCompletedById(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <option value="">Select technician</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={confirmReady}
                disabled={saving}
                className="flex-1 rounded-md bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirm Ready
              </button>
              <button
                onClick={() => setShowReadyForm(false)}
                className="flex-1 rounded-md border border-slate-300 bg-white py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!showReadyForm && selectableStatuses.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-900">
              {job.status === "Delivered" ? "Reopen Job (Admin)" : "Update Status"}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {selectableStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={saving}
                  className="rounded-md bg-emerald-600 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isLocked && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-900">Remarks</h3>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Motor replaced, waiting for spare, customer informed"
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
            <button
              onClick={handleSaveRemarks}
              disabled={saving}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
            >
              Save Remarks
            </button>
          </div>
        )}

        {job.remarks && isLocked && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-2 font-semibold text-slate-900">Remarks</h3>
            <p className="text-sm text-slate-700">{job.remarks}</p>
          </div>
        )}

        {job.status !== "Delivered" && isStaff && (
          <Link
            href={`/jobs/delivery?q=${encodeURIComponent(job.jobNumber)}`}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Go to Delivery
          </Link>
        )}

        {isStaff && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-900">Reprint Customer Receipt</h3>
            <ReceiptActions job={job} />
          </div>
        )}

        {job.statusHistory.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-900">Status History</h3>
            <div className="space-y-3">
              {job.statusHistory.map((entry) => (
                <div key={entry.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <JobStatusBadge status={entry.status} />
                    <p className="text-xs text-slate-500">
                      {new Date(entry.changedAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Updated by: {formatStatusChangedBy(entry.changedBy)}
                  </p>
                  {entry.note && (
                    <p className="mt-0.5 text-xs text-slate-500">{entry.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
