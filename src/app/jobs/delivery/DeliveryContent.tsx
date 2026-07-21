"use client";

import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import { PageHeader } from "@/components/PageHeader";
import { SignaturePad } from "@/components/SignaturePad";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type DeliveryJob = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand?: string | null;
  finalCost?: number | null;
  customer: { mobile: string; name?: string | null };
};

export default function DeliveryContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [signingJob, setSigningJob] = useState<DeliveryJob | null>(null);
  const [receiptSlipReturned, setReceiptSlipReturned] = useState(true);
  const [deliveryNote, setDeliveryNote] = useState("");

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;

    setLoading(true);
    setSuccessMsg("");
    const params = new URLSearchParams({ q: q.trim() });

    const res = await fetch(`/api/jobs?${params}`);
    const data = await res.json();
    setResults(data);
    setSearched(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialQ) search(initialQ);
  }, [initialQ, search]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    search(query);
  }

  function openSignatureFlow(job: DeliveryJob) {
    if (job.status !== "Ready") {
      alert(`Job ${job.jobNumber} is not ready for delivery yet (status: ${job.status}).`);
      return;
    }
    setReceiptSlipReturned(true);
    setDeliveryNote("");
    setSigningJob(job);
  }

  async function completeDelivery(signature: string) {
    if (!signingJob) return;

    setDeliveringId(signingJob.id);
    const res = await fetch(`/api/jobs/${signingJob.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "Delivered",
        deliverySignature: signature,
        receiptSlipReturned,
        deliveryNote: deliveryNote.trim() || undefined,
        note: "Delivered — customer signature captured",
      }),
    });

    if (res.ok) {
      setResults((prev) => prev.filter((j) => j.id !== signingJob.id));
      setSuccessMsg(`${signingJob.jobNumber} delivered with signature`);
      setQuery("");
      setSearched(false);
      setSigningJob(null);
    } else {
      let message = "Failed to mark delivered";
      try {
        const data = await res.json();
        message = data.error ?? message;
      } catch {
        message = `Server error (${res.status}). Restart dev server after schema update.`;
      }
      alert(message);
    }

    setDeliveringId(null);
  }

  const readyResults = results.filter((j) => j.status === "Ready");
  const otherResults = results.filter((j) => j.status !== "Ready" && j.status !== "Delivered");

  return (
    <AppShell>
      <div className="space-y-4">
      <PageHeader
        title="Delivery"
        description="Search job, collect signature, mark delivered"
      />

        <form onSubmit={handleSearch} className="space-y-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Job card # or mobile number"
            className="w-full rounded-xl border border-gray-300 px-4 py-4 text-lg focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full rounded-xl bg-orange-600 py-4 text-lg font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? "Searching…" : "Find Job"}
          </button>
        </form>

        {successMsg && (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-center font-medium text-green-800">
            ✓ {successMsg}
          </div>
        )}

        {searched && !loading && results.length === 0 && (
          <p className="text-center text-gray-500">No jobs found</p>
        )}

        {readyResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-emerald-700">Ready for delivery</p>
            {readyResults.map((job) => (
              <JobListCard
                key={job.id}
                id={job.id}
                jobNumber={job.jobNumber}
                status={job.status}
                customerName={job.customer.name}
                mobile={job.customer.mobile}
                applianceLine={[job.brand, job.applianceType].filter(Boolean).join(" ")}
                finalCost={job.finalCost}
                footer={
                  <button
                    onClick={() => openSignatureFlow(job)}
                    disabled={deliveringId === job.id}
                    className="w-full rounded-md bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {deliveringId === job.id
                      ? "Updating…"
                      : "Collect Signature & Deliver"}
                  </button>
                }
              />
            ))}
          </div>
        )}

        {otherResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-700">Not ready for delivery yet</p>
            {otherResults.map((job) => (
              <JobListCard
                key={job.id}
                id={job.id}
                jobNumber={job.jobNumber}
                status={job.status}
                customerName={job.customer.name}
                mobile={job.customer.mobile}
                applianceLine={[job.brand, job.applianceType].filter(Boolean).join(" ")}
                meta="Product still in repair — tap to view"
              />
            ))}
          </div>
        )}

        {searched &&
          results.length > 0 &&
          readyResults.length === 0 &&
          otherResults.length === 0 && (
            <p className="text-center text-sm text-gray-500">
              All matching jobs are already delivered
            </p>
          )}
      </div>

      {signingJob && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900">{signingJob.jobNumber}</h3>
              <p className="text-sm text-gray-600">
                {signingJob.brand} {signingJob.applianceType}
                {signingJob.finalCost != null && ` · Rs ${signingJob.finalCost}`}
              </p>
            </div>

            <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={receiptSlipReturned}
                onChange={(e) => setReceiptSlipReturned(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Customer receipt slip returned
            </label>

            <input
              type="text"
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder="Optional note (e.g. collected by spouse)"
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />

            <SignaturePad
              embedded
              onConfirm={completeDelivery}
              onCancel={() => setSigningJob(null)}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
