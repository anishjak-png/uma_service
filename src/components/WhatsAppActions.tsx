"use client";

import { useState } from "react";

type WhatsAppActionsProps = {
  jobId: string;
  jobStatus: string;
  compact?: boolean;
};

export function WhatsAppActions({ jobId, jobStatus, compact = false }: WhatsAppActionsProps) {
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");

  const canSend =
    jobStatus === "Pending" ||
    jobStatus === "WaitingForCustomerApproval" ||
    jobStatus === "Ready" ||
    jobStatus === "Return";

  async function sendWhatsApp() {
    setSending(true);
    setStatusMsg("");
    setError("");
    const res = await fetch(`/api/jobs/${jobId}/notifications/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.ok) {
      setStatusMsg(data.message ?? "WhatsApp sent");
    } else {
      setError(data.error ?? "WhatsApp send failed");
    }
    setSending(false);
  }

  async function resendWhatsApp() {
    setSending(true);
    setStatusMsg("");
    setError("");
    const res = await fetch(`/api/jobs/${jobId}/notifications/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resend: true }),
    });
    const data = await res.json();
    if (data.ok) {
      setStatusMsg("WhatsApp resent");
    } else {
      setError(data.error ?? "WhatsApp resend failed");
    }
    setSending(false);
  }

  if (!canSend) {
    if (compact) return null;
    return (
      <p className="text-xs text-slate-500">
        WhatsApp messages are not configured for Delivered jobs.
      </p>
    );
  }

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={sendWhatsApp}
            disabled={sending}
            className="inline-flex h-8 flex-1 min-w-[5.5rem] items-center justify-center rounded-md bg-emerald-600 px-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {sending ? "Sending…" : "WhatsApp"}
          </button>
          <button
            type="button"
            onClick={resendWhatsApp}
            disabled={sending}
            className="inline-flex h-8 flex-1 min-w-[5.5rem] items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Resend
          </button>
        </div>
        {statusMsg && (
          <p className="text-[10px] font-medium text-emerald-700">{statusMsg}</p>
        )}
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-600">WhatsApp</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={sendWhatsApp}
          disabled={sending}
          className="rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send WhatsApp"}
        </button>
        <button
          type="button"
          onClick={resendWhatsApp}
          disabled={sending}
          className="rounded-md border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Resend WhatsApp
        </button>
      </div>
      {statusMsg && (
        <p className="text-xs font-medium text-emerald-700">{statusMsg}</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
