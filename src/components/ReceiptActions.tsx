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
  customer: { mobile: string; name?: string | null };
}

type PrintStatus = {
  status: string;
  lastError?: string | null;
};

export function ReceiptActions({
  job,
  autoPoll = false,
}: {
  job: JobForReceipt;
  autoPoll?: boolean;
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

  async function handleReprint() {
    setReprinting(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/print`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error ?? "Reprint failed");
        return;
      }
      setPrintStatus({ status: "Pending" });
      setStatus("Sent to counter printer…");
      await fetchPrintStatus();
    } catch {
      setStatus("Reprint failed");
    } finally {
      setReprinting(false);
    }
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

  function handleBrowserPrint() {
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt ${job.jobNumber}</title>
      <style>
        body { font-family: monospace; font-size: 12px; padding: 16px; max-width: 320px; margin: 0 auto; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
      </style></head>
      <body><pre>${receiptText}</pre>
      <script>window.onload = () => { window.print(); }</script>
      </body></html>
    `);
    win.document.close();
  }

  const printState = printStatus?.status;

  return (
    <div className="space-y-2">
      {autoPoll && printState && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            printState === "Done"
              ? "bg-green-50 text-green-800"
              : printState === "Failed"
                ? "bg-amber-50 text-amber-800"
                : "bg-blue-50 text-blue-800"
          }`}
        >
          {printState === "Done" && "Receipt printed on counter printer"}
          {printState === "Pending" && "Sending to counter printer…"}
          {printState === "Printing" && "Printing…"}
          {printState === "Failed" &&
            `Print failed${printStatus?.lastError ? `: ${printStatus.lastError}` : ""}`}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleReprint}
          disabled={reprinting}
          className="flex-1 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {reprinting
            ? "Sending…"
            : autoPoll && printState === "Failed"
              ? "Retry Print"
              : autoPoll && printState === "Done"
                ? "Reprint"
                : "Print to Counter"}
        </button>
        <button
          onClick={handleBrowserPrint}
          className="flex-1 rounded-xl border-2 border-orange-600 px-4 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-50"
        >
          Print / PDF
        </button>
      </div>

      <button
        onClick={handleBluetoothPrint}
        disabled={printing}
        className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      >
        {printing ? "Printing…" : "Bluetooth fallback (phone)"}
      </button>

      {status && <p className="text-sm text-gray-600">{status}</p>}
    </div>
  );
}
