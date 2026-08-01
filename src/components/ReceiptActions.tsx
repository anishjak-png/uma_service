"use client";

import {
  buildReceiptData,
  formatReceiptText80mm,
} from "@/lib/thermal";
import { printViaBluetooth } from "@/lib/thermal-bluetooth";
import { useCallback, useEffect, useState } from "react";

interface JobForReceipt {
  id: string;
  jobNumber: string;
  receivedAt: string;
  applianceType: string;
  brand?: string | null;
  model?: string | null;
  complaint: string;
  accessories?: string | null;
  customer: { mobile: string; name?: string | null };
}

type PrintStatus = {
  status: string;
  errorMessage?: string | null;
};

export function ReceiptActions({
  job,
  autoPoll = false,
  variant = "default",
  counterOnly = false,
  actionTab = false,
  reprintOnly = false,
}: {
  job: JobForReceipt;
  autoPoll?: boolean;
  variant?: "default" | "jobDetail";
  counterOnly?: boolean;
  /** Match job-detail status action buttons (grey, grid cell). */
  actionTab?: boolean;
  /** Job-created screen: single reprint button only. */
  reprintOnly?: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [printStatus, setPrintStatus] = useState<PrintStatus | null>(null);
  const [printing, setPrinting] = useState(false);
  const [reprinting, setReprinting] = useState(false);

  const receiptData = buildReceiptData({
    ...job,
    receivedAt: new Date(job.receivedAt),
  });
  const receiptText = formatReceiptText80mm(receiptData);

  const fetchPrintStatus = useCallback(async () => {
    const res = await fetch(`/api/jobs/${job.id}/print`);
    if (res.ok) {
      const data = await res.json();
      setPrintStatus(data);
      return data as PrintStatus;
    }
    return null;
  }, [job.id]);

  useEffect(() => {
    if (!autoPoll) return;

    fetchPrintStatus();
    const interval = setInterval(fetchPrintStatus, 1500);
    const timeout = setTimeout(() => clearInterval(interval), 20000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [autoPoll, fetchPrintStatus]);

  async function handleCounterPrint() {
    setReprinting(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/print`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error ?? "Print failed");
        return;
      }
      setPrintStatus({ status: "Pending" });
      setStatus("Sent to counter printer…");

      for (let attempt = 0; attempt < 12; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const latest = await fetchPrintStatus();
        if (latest?.status === "Printed") {
          setStatus("Receipt printed on counter printer");
          return;
        }
        if (latest?.status === "Failed") {
          setStatus(
            latest.errorMessage
              ? `Print failed: ${latest.errorMessage}`
              : "Print failed"
          );
          return;
        }
      }
    } catch {
      setStatus("Print failed");
    } finally {
      setReprinting(false);
    }
  }

  async function handleReprint() {
    await handleCounterPrint();
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function handleBrowserPrint() {
    setStatus(null);
    const html = `<!DOCTYPE html>
<html><head><title>Receipt ${escapeHtml(job.jobNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: "Courier New", Courier, monospace; font-size: 12px; padding: 8px; max-width: 80mm; margin: 0 auto; }
  pre { white-space: pre-wrap; word-wrap: break-word; margin: 0; }
</style></head>
<body><pre>${escapeHtml(receiptText)}</pre></body></html>`;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:none;visibility:hidden";
    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    const frameDoc = frameWindow?.document;
    if (!frameWindow || !frameDoc) {
      document.body.removeChild(iframe);
      setStatus("Could not open print preview");
      return;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    window.setTimeout(() => {
      try {
        frameWindow.focus();
        frameWindow.print();
        setStatus("Print dialog opened — choose your printer");
      } catch {
        setStatus("Print blocked — use Reprint Receipt for counter printer");
      } finally {
        window.setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1000);
      }
    }, 300);
  }

  async function handleBluetoothPrint() {
    setPrinting(true);
    setStatus(null);
    try {
      await printViaBluetooth(receiptText);
      setStatus("Printed via Bluetooth");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Print failed");
    } finally {
      setPrinting(false);
    }
  }

  const printState = printStatus?.status;

  if (reprintOnly) {
    return (
      <div className="space-y-2">
        {autoPoll && printState && (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-medium ${
              printState === "Printed"
                ? "bg-green-50 text-green-800"
                : printState === "Failed"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-blue-50 text-blue-800"
            }`}
          >
            {printState === "Printed" && "Receipt printed on counter printer"}
            {printState === "Pending" && "Sending to counter printer…"}
            {printState === "Printing" && "Printing…"}
            {printState === "Failed" &&
              `Print failed${printStatus?.errorMessage ? `: ${printStatus.errorMessage}` : ""}`}
          </div>
        )}
        <button
          type="button"
          onClick={handleReprint}
          disabled={reprinting}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
        >
          {reprinting
            ? "Sending…"
            : autoPoll && printState === "Failed"
              ? "Retry Print"
              : "Reprint Receipt"}
        </button>
        {status && <p className="text-sm text-slate-600">{status}</p>}
      </div>
    );
  }

  if (counterOnly && actionTab) {
    return (
      <>
        <button
          type="button"
          onClick={handleCounterPrint}
          disabled={reprinting}
          className="rounded-md bg-slate-500 py-2 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-50"
        >
          {reprinting ? "Sending…" : "Print Receipt"}
        </button>
        {status && (
          <p className="col-span-full text-[10px] text-slate-600">{status}</p>
        )}
      </>
    );
  }

  if (counterOnly) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={handleCounterPrint}
          disabled={reprinting}
          className="inline-flex h-8 w-full items-center justify-center rounded-md bg-emerald-600 px-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
        >
          {reprinting ? "Sending…" : "Print Receipt"}
        </button>
        {status && (
          <p className="text-[10px] text-slate-600">{status}</p>
        )}
      </div>
    );
  }

  return (
    <div className={variant === "jobDetail" ? "space-y-1" : "space-y-2"}>
      {autoPoll && printState && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            printState === "Printed"
              ? "bg-green-50 text-green-800"
              : printState === "Failed"
                ? "bg-amber-50 text-amber-800"
                : "bg-blue-50 text-blue-800"
          }`}
        >
          {printState === "Printed" && "Receipt printed on counter printer"}
          {printState === "Pending" && "Sending to counter printer…"}
          {printState === "Printing" && "Printing…"}
          {printState === "Failed" &&
            `Print failed${printStatus?.errorMessage ? `: ${printStatus.errorMessage}` : ""}`}
        </div>
      )}

      <div className={variant === "jobDetail" ? "flex flex-wrap gap-1.5" : "flex flex-wrap gap-2"}>
        {variant === "jobDetail" ? (
          <>
            <button
              onClick={handleCounterPrint}
              disabled={reprinting}
              className="inline-flex h-8 flex-1 min-w-[5.5rem] items-center justify-center rounded-md bg-emerald-600 px-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
            >
              {reprinting ? "Sending…" : "Print"}
            </button>
            <button
              onClick={handleReprint}
              disabled={reprinting}
              className="inline-flex h-8 flex-1 min-w-[5.5rem] items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
            >
              {reprinting ? "Sending…" : "Reprint"}
            </button>
            <button
              onClick={handleBrowserPrint}
              className="inline-flex h-8 flex-1 min-w-[5.5rem] items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              PDF
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleReprint}
              disabled={reprinting}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
            >
              {reprinting
                ? "Sending…"
                : autoPoll && printState === "Failed"
                  ? "Retry Print"
                  : autoPoll && printState === "Printed"
                    ? "Reprint"
                    : "Print to Counter"}
            </button>
            <button
              onClick={handleBrowserPrint}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Print / PDF
            </button>
          </>
        )}
      </div>

      {variant !== "jobDetail" && (
        <button
          onClick={handleBluetoothPrint}
          disabled={printing}
          className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
        >
          {printing ? "Printing…" : "Bluetooth fallback (phone)"}
        </button>
      )}

      {status && (
        <p className={variant === "jobDetail" ? "text-[10px] text-slate-600" : "text-sm text-slate-600"}>
          {status}
        </p>
      )}
    </div>
  );
}
