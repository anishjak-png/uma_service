"use client";

import { StatCard } from "@/components/StatCard";
import { formatCurrency } from "@/lib/currency";
import type { SlipPeriodSeries, SlipYearBucket } from "@/lib/slip-service";
import { useEffect, useState } from "react";

function changeLabel(change: number | null): { text: string; className: string } {
  if (change == null) {
    return { text: "No last-year figure", className: "text-slate-400" };
  }
  const rounded = Math.round(change);
  if (rounded === 0) {
    return { text: "Same as last year", className: "text-slate-500" };
  }
  const sign = rounded > 0 ? "+" : "";
  return {
    text: `${sign}${rounded}% vs last year`,
    className: rounded > 0 ? "text-emerald-700" : "text-red-700",
  };
}

function daysLabel(days: number): string {
  return `${days} day${days === 1 ? "" : "s"} entered`;
}

function YearGrid({ years }: { years: SlipYearBucket[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {years.map((row) => (
        <StatCard
          key={`${row.yearsAgo}-${row.from}`}
          label={row.label}
          value={formatCurrency(row.amount)}
          subtext={daysLabel(row.days)}
          valueClassName={row.yearsAgo === 0 ? "text-emerald-800" : undefined}
        />
      ))}
    </div>
  );
}

function PeriodBlock({ row }: { row: SlipPeriodSeries }) {
  const change = changeLabel(row.changeVsLastYear);
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {row.label}
      </p>
      <YearGrid years={row.years} />
      <p className={`text-xs font-medium ${change.className}`}>{change.text}</p>
    </div>
  );
}

export function SlipServiceReport() {
  const [comparisons, setComparisons] = useState<SlipPeriodSeries[]>([]);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rangeResult, setRangeResult] = useState<SlipPeriodSeries | null>(null);
  const [rangeError, setRangeError] = useState("");
  const [rangeLoading, setRangeLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/admin/reports/slip");
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Failed to load slip report");
        setLoading(false);
        return;
      }
      setToday(data.today ?? "");
      setComparisons(data.comparisons ?? []);
      if (data.today) {
        setFromDate((prev) => prev || data.today);
        setToDate((prev) => prev || data.today);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadRange() {
    if (!fromDate || !toDate) {
      setRangeError("Pick both dates");
      return;
    }
    setRangeLoading(true);
    setRangeError("");
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    const res = await fetch(`/api/admin/reports/slip?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setRangeResult(null);
      setRangeError(data.error ?? "Failed to load range");
      setRangeLoading(false);
      return;
    }
    setRangeResult(data.customRange ?? null);
    setRangeLoading(false);
  }

  if (loading) {
    return <p className="text-center text-slate-500">Loading slip report…</p>;
  }
  if (error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Slip service value only — not mixed with job collection. Shop date{" "}
        {today}.
      </p>
      {comparisons.map((row) => (
        <PeriodBlock key={row.id} row={row} />
      ))}

      <div className="space-y-2 border-t border-slate-200 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Date range
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-slate-600">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-600">
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void loadRange()}
          disabled={rangeLoading}
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {rangeLoading ? "Loading…" : "Show range"}
        </button>
        {rangeError && (
          <p className="text-xs text-red-600">{rangeError}</p>
        )}
        {rangeResult && <PeriodBlock row={rangeResult} />}
      </div>
    </div>
  );
}
