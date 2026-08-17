"use client";

import { useCallback, useEffect, useState } from "react";
import { printViaBluetooth } from "@/lib/thermal-bluetooth";
import { printThermal80mm } from "../lib/print-receipt";
import {
  buildSaleReceiptData,
  formatSaleReceiptText80mm,
  type SaleReceiptData,
  type SaleReceiptItem,
} from "../lib/thermal-sale";
import { btnPrimary, btnSecondary } from "./ui";

export type ClosedSale = {
  bill_no: string;
  total: number;
  created_at: string;
  items: SaleReceiptItem[];
  printJobId?: string;
};

type PrintStatus = {
  status: string;
  errorMessage?: string | null;
};

export function SaleReceipt({
  sale,
  autoPoll = false,
  onNewBill,
}: {
  sale: ClosedSale;
  autoPoll?: boolean;
  onNewBill: () => void;
}) {
  const [printJobId, setPrintJobId] = useState(sale.printJobId);
  const [status, setStatus] = useState("");
  const [printStatus, setPrintStatus] = useState<PrintStatus | null>(null);
  const [reprinting, setReprinting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const receiptData = buildSaleReceiptData(sale);
  const receiptText = formatSaleReceiptText80mm(receiptData);

  const fetchPrintStatus = useCallback(async () => {
    if (!printJobId) return null;
    const res = await fetch(`/api/spare-parts/sales/print?printJobId=${encodeURIComponent(printJobId)}`);
    if (res.ok) {
      const data = (await res.json()) as PrintStatus;
      setPrintStatus(data);
      return data;
    }
    return null;
  }, [printJobId]);

  useEffect(() => {
    if (!autoPoll || !printJobId) return;
    void fetchPrintStatus();
    const interval = setInterval(() => void fetchPrintStatus(), 1500);
    const timeout = setTimeout(() => clearInterval(interval), 20000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [autoPoll, fetchPrintStatus, printJobId]);

  async function sendToCounter() {
    setReprinting(true);
    setStatus("");
    try {
      const res = await fetch("/api/spare-parts/sales/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: receiptData, printJobId }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        printJobId?: string;
      } | null;
      if (!res.ok) {
        setStatus(data?.error ?? "Print failed");
        return;
      }
      if (data?.printJobId) setPrintJobId(data.printJobId);
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
          setStatus(latest.errorMessage ? `Print failed: ${latest.errorMessage}` : "Print failed");
          return;
        }
      }
    } catch {
      setStatus("Print failed");
    } finally {
      setReprinting(false);
    }
  }

  function handleBrowserPrint() {
    const opened = printThermal80mm(receiptText, sale.bill_no);
    setStatus(opened ? "Print dialog opened — choose your printer" : "Could not open print preview");
  }

  async function handleBluetooth() {
    setPrinting(true);
    setStatus("");
    try {
      await printViaBluetooth(receiptText);
      setStatus("Printed via Bluetooth");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Print failed");
    } finally {
      setPrinting(false);
    }
  }

  const printState = printStatus?.status;

  return (
    <div className="space-y-3">
      {printState ? (
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
      ) : null}

      <pre className="mx-auto max-w-[80mm] overflow-x-auto rounded-lg bg-white p-3 font-mono text-[12px] leading-[1.35] text-slate-900">
        {receiptText}
      </pre>

      <div className="flex gap-2">
        <button type="button" className={btnPrimary} disabled={reprinting} onClick={() => void sendToCounter()}>
          {reprinting ? "Sending…" : printState === "Failed" ? "Retry Print" : "Print"}
        </button>
        <button type="button" className={btnSecondary} disabled={reprinting} onClick={() => void sendToCounter()}>
          {reprinting ? "Sending…" : "Reprint Receipt"}
        </button>
      </div>
      <button type="button" className={btnSecondary} onClick={handleBrowserPrint}>
        Print / PDF
      </button>
      <button type="button" className={btnSecondary} disabled={printing} onClick={() => void handleBluetooth()}>
        {printing ? "Printing…" : "Bluetooth fallback (phone)"}
      </button>
      <button type="button" className={btnSecondary} onClick={onNewBill}>
        New bill
      </button>
      {status ? <p className="text-center text-xs text-slate-600">{status}</p> : null}
    </div>
  );
}

export type { SaleReceiptData };
