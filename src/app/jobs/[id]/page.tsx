"use client";

import { AppShell } from "@/components/AppShell";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { ReceiptActions } from "@/components/ReceiptActions";
import { STATUS_FLOW, STATUS_LABELS } from "@/lib/constants";
import { daysSince, formatMobileDisplay } from "@/lib/jobs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Technician = { id: string; name: string };

type JobDetail = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand?: string | null;
  model?: string | null;
  complaint: string;
  finalCost?: number | null;
  internalNotes?: string | null;
  receivedAt: string;
  readyAt?: string | null;
  deliveredAt?: string | null;
  deliverySignature?: string | null;
  deliveredBy?: string | null;
  receiptSlipReturned?: boolean;
  deliveryNote?: string | null;
  readyWhatsappSent: boolean;
  assignedTechnicianId?: string | null;
  attendedTechnicianId?: string | null;
  assignedTechnician?: { id: string; name: string } | null;
  attendedTechnician?: { id: string; name: string } | null;
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
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalCost, setFinalCost] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [attendedTechnicianId, setAttendedTechnicianId] = useState("");

  const fetchJob = useCallback(async () => {
    const [jobRes, techRes] = await Promise.all([
      fetch(`/api/jobs/${id}`),
      fetch("/api/technicians"),
    ]);

    if (!jobRes.ok) {
      router.push("/jobs/search");
      return;
    }

    const data = await jobRes.json();
    setJob(data);
    setFinalCost(data.finalCost?.toString() ?? "");
    setInternalNotes(data.internalNotes ?? "");
    setAttendedTechnicianId(data.attendedTechnicianId ?? "");
    setTechnicians(await techRes.json());
    setLoading(false);
  }, [id, router]);

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
      setFinalCost(data.finalCost?.toString() ?? "");
      setInternalNotes(data.internalNotes ?? "");
      setAttendedTechnicianId(data.attendedTechnicianId ?? "");
    }
    setSaving(false);
  }

  async function handleStatusChange(status: string) {
    const payload: Record<string, unknown> = { status };
    if (status === "Ready" && finalCost) {
      payload.finalCost = finalCost;
    }
    if (attendedTechnicianId) {
      payload.attendedTechnicianId = attendedTechnicianId;
    }
    await updateJob(payload);
  }

  async function handleSaveDetails() {
    await updateJob({
      finalCost: finalCost || null,
      internalNotes,
      attendedTechnicianId: attendedTechnicianId || null,
    });
  }

  if (loading || !job) {
    return (
      <AppShell>
        <p className="text-center text-gray-500">Loading…</p>
      </AppShell>
    );
  }

  const nextStatuses = STATUS_FLOW[job.status] ?? [];
  const backHref = job.status === "Delivered" || job.status === "Closed" ? "/jobs/search" : "/jobs/pending";

  return (
    <AppShell>
      <div className="space-y-4">
        <Link href={backHref} className="text-sm font-medium text-orange-600">
          ← Back
        </Link>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{job.jobNumber}</h2>
              <p className="text-gray-600">
                {job.customer.name ?? formatMobileDisplay(job.customer.mobile)}
              </p>
              <p className="text-sm text-gray-500">
                {formatMobileDisplay(job.customer.mobile)}
              </p>
            </div>
            <JobStatusBadge status={job.status} />
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="font-medium text-gray-700">Appliance:</span>{" "}
              {[job.brand, job.model, job.applianceType].filter(Boolean).join(" ")}
            </p>
            <p>
              <span className="font-medium text-gray-700">Complaint:</span> {job.complaint}
            </p>
            <p>
              <span className="font-medium text-gray-700">Received:</span>{" "}
              {new Date(job.receivedAt).toLocaleDateString("en-IN")} (
              {daysSince(new Date(job.receivedAt))} days ago)
            </p>
            {job.assignedTechnician && (
              <p>
                <span className="font-medium text-gray-700">Assigned technician:</span>{" "}
                {job.assignedTechnician.name}
              </p>
            )}
            {job.attendedTechnician && (
              <p>
                <span className="font-medium text-gray-700">Attended by:</span>{" "}
                {job.attendedTechnician.name}
              </p>
            )}
            {job.finalCost != null && (
              <p className="text-lg font-bold text-green-700">Final Cost: Rs {job.finalCost}</p>
            )}
          </div>
        </div>

        {nextStatuses.length > 0 && (
          <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
            <h3 className="font-semibold text-gray-900">Update Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {nextStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={saving}
                  className={`rounded-xl py-3 text-sm font-semibold disabled:opacity-50 ${
                    status === "Delivered"
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : status === "Ready"
                        ? "bg-green-500 text-white hover:bg-green-600"
                        : "bg-orange-100 text-orange-800 hover:bg-orange-200"
                  }`}
                >
                  → {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>
        )}

        {job.status !== "Delivered" && job.status !== "Closed" && (
          <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
            <h3 className="font-semibold text-gray-900">Repair Details</h3>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Technician Who Attended *
              </label>
              <select
                value={attendedTechnicianId}
                onChange={(e) => setAttendedTechnicianId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm"
              >
                <option value="">Select technician</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Final Cost (Rs)
              </label>
              <input
                type="number"
                value={finalCost}
                onChange={(e) => setFinalCost(e.target.value)}
                placeholder="Enter final repair cost"
                className="w-full rounded-lg border border-gray-300 px-3 py-3"
              />
            </div>

            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Internal notes (parts used, etc.)"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />

            <button
              onClick={handleSaveDetails}
              disabled={saving}
              className="w-full rounded-xl bg-gray-800 py-3 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50"
            >
              Save Details
            </button>
          </div>
        )}

        {job.status === "Ready" && (
          <Link
            href={`/jobs/delivery?q=${encodeURIComponent(job.jobNumber)}`}
            className="block w-full rounded-xl bg-green-600 py-4 text-center text-lg font-semibold text-white hover:bg-green-700"
          >
            Go to Delivery (Signature Required)
          </Link>
        )}

        {(job.status === "Delivered" || job.status === "Closed") && (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-2 ring-green-100">
            <h3 className="mb-3 font-semibold text-gray-900">Delivery Proof</h3>
            {job.deliveredAt && (
              <p className="text-sm text-gray-700">
                <span className="font-medium">Delivered:</span>{" "}
                {new Date(job.deliveredAt).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
            {job.deliveredBy && (
              <p className="mt-1 text-sm text-gray-700">
                <span className="font-medium">Handled by:</span> {job.deliveredBy}
              </p>
            )}
            <p className="mt-1 text-sm text-gray-700">
              <span className="font-medium">Receipt slip:</span>{" "}
              {job.receiptSlipReturned ? "Returned" : "Not recorded"}
            </p>
            {job.deliveryNote && (
              <p className="mt-1 text-sm text-gray-600">Note: {job.deliveryNote}</p>
            )}
            {job.deliverySignature ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-gray-500">Customer signature</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={job.deliverySignature}
                  alt="Customer delivery signature"
                  className="max-h-40 rounded-lg border border-gray-200 bg-white"
                />
              </div>
            ) : (
              <p className="mt-2 text-sm text-amber-700">
                No signature on record (delivered before signature feature)
              </p>
            )}
          </div>
        )}

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-900">Reprint Customer Receipt</h3>
          <ReceiptActions job={job} />
        </div>

        {job.statusHistory.length > 0 && (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-semibold text-gray-900">History</h3>
            <div className="space-y-2">
              {job.statusHistory.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-sm">
                  <div>
                    <JobStatusBadge status={entry.status} />
                    {entry.note && (
                      <p className="mt-0.5 text-xs text-gray-500">{entry.note}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(entry.changedAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
