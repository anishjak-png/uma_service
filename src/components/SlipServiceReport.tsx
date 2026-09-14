"use client";

import { StatCard } from "@/components/StatCard";
import { formatCurrency } from "@/lib/currency";
import type { SlipComparison } from "@/lib/slip-service";
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

export function SlipServiceReport() {
  const [comparisons, setComparisons] = useState<SlipComparison[]>([]);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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
      {comparisons.map((row) => {
        const change = changeLabel(row.change);
        return (
          <div key={row.label} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {row.label}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                label={row.currentLabel}
                value={formatCurrency(row.current.amount)}
                subtext={`${row.current.days} day${row.current.days === 1 ? "" : "s"} entered`}
                valueClassName="text-emerald-800"
              />
              <StatCard
                label={row.previousLabel}
                value={formatCurrency(row.previous.amount)}
                subtext={`${row.previous.days} day${row.previous.days === 1 ? "" : "s"} entered`}
              />
            </div>
            <p className={`text-xs font-medium ${change.className}`}>{change.text}</p>
          </div>
        );
      })}
    </div>
  );
}
