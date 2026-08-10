"use client";

import { useEffect, useState } from "react";
import type { DeliveryCallOutcome } from "@/lib/delivery-contact";
import { formatMobileDisplay, normalizeMobile } from "@/lib/jobs";

type DeliveryCallLogModalProps = {
  open: boolean;
  jobId: string;
  jobNumber: string;
  customerName: string | null;
  mobile: string;
  onClose: () => void;
  onSaved: (result: {
    deliveryContactStatus: "not_contacted" | "contacted";
    expectedDeliveryAt: string | null;
  }) => void;
};

export function DeliveryCallLogModal({
  open,
  jobId,
  jobNumber,
  customerName,
  mobile,
  onClose,
  onSaved,
}: DeliveryCallLogModalProps) {
  const [outcome, setOutcome] = useState<DeliveryCallOutcome>("coming_in");
  const [days, setDays] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setOutcome("coming_in");
    setDays("1");
    setError("");
    setSaving(false);
  }, [open, jobId]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const displayName = customerName ?? formatMobileDisplay(mobile);
  const digits = normalizeMobile(mobile);

  async function handleSave() {
    setSaving(true);
    setError("");

    const payload: { outcome: DeliveryCallOutcome; days?: number } = { outcome };
    if (outcome === "coming_in") {
      const parsed = Number.parseInt(days, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError("Enter number of days (0 or more)");
        setSaving(false);
        return;
      }
      payload.days = parsed;
    }

    const res = await fetch(`/api/jobs/${jobId}/delivery-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to save call log");
      return;
    }

    onSaved({
      deliveryContactStatus: data.job.deliveryContactStatus,
      expectedDeliveryAt: data.job.expectedDeliveryAt ?? null,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        className="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-call-title"
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p id="delivery-call-title" className="text-sm font-semibold text-slate-900">
                Log delivery call
              </p>
              <p className="truncate text-xs text-slate-600">
                {jobNumber} · {displayName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {digits.length === 10 && (
            <a
              href={`tel:${digits}`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Call {formatMobileDisplay(mobile)}
            </a>
          )}
        </div>

        <div className="space-y-2 px-4 py-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50">
            <input
              type="radio"
              name="call-outcome"
              checked={outcome === "coming_in"}
              onChange={() => setOutcome("coming_in")}
              className="mt-0.5"
            />
            <span className="flex-1">
              <span className="block text-sm font-medium text-slate-900">Coming in</span>
              {outcome === "coming_in" && (
                <span className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="h-9 w-20 rounded-md border border-slate-300 px-2 text-sm"
                    aria-label="Days until pickup"
                  />
                  <span className="text-xs text-slate-600">days</span>
                </span>
              )}
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50">
            <input
              type="radio"
              name="call-outcome"
              checked={outcome === "no_answer"}
              onChange={() => setOutcome("no_answer")}
            />
            <span className="text-sm font-medium text-slate-900">No answer</span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50">
            <input
              type="radio"
              name="call-outcome"
              checked={outcome === "not_reachable"}
              onChange={() => setOutcome("not_reachable")}
            />
            <span className="text-sm font-medium text-slate-900">Not reachable</span>
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
