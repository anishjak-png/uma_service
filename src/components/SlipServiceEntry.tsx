"use client";

import { formatCurrency } from "@/lib/currency";
import { formatSlipDay } from "@/lib/slip-service";
import { useCallback, useEffect, useState } from "react";

type SlipEntry = {
  date: string;
  amount: number;
  enteredBy: string | null;
};

export function SlipServiceEntry() {
  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [entries, setEntries] = useState<SlipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const applyAmountForDate = useCallback((nextDate: string, list: SlipEntry[]) => {
    const match = list.find((row) => row.date === nextDate);
    setAmount(match ? String(match.amount) : "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/slip-service");
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Failed to load slip values");
        setLoading(false);
        return;
      }
      const list = (data.entries ?? []) as SlipEntry[];
      setToday(data.today);
      setEntries(list);
      setDate(data.today);
      applyAmountForDate(data.today, list);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [applyAmountForDate]);

  function selectDate(next: string) {
    setDate(next);
    setMessage("");
    applyAmountForDate(next, entries);
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/slip-service", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, amount }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      setSaving(false);
      return;
    }
    setMessage("Saved");
    setAmount(String(data.amount));
    setEntries((prev) => {
      const next = prev.filter((row) => row.date !== data.date);
      return [
        {
          date: data.date,
          amount: data.amount,
          enteredBy: data.enteredBy,
        },
        ...next,
      ].sort((a, b) => (a.date < b.date ? 1 : -1));
    });
    setSaving(false);
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Slip service value
        </p>
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
            <input
              type="date"
              max={today}
              value={date}
              onChange={(e) => selectDate(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Amount
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onFocus={(e) => {
                if (e.target.value === "0") setAmount("");
                else e.target.select();
              }}
              placeholder="0"
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={saving || !date}
            className="w-full rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {message && (
            <p className="text-xs font-medium text-emerald-700">{message}</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>

      {entries.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recent
          </p>
          <ul className="divide-y divide-slate-100">
            {entries.map((row) => (
              <li key={row.date}>
                <button
                  type="button"
                  onClick={() => selectDate(row.date)}
                  className={`flex w-full items-center justify-between gap-2 py-2 text-left text-sm ${
                    row.date === date ? "font-semibold text-emerald-800" : "text-slate-800"
                  }`}
                >
                  <span>
                    {formatSlipDay(row.date)}
                    {row.date === today ? " · Today" : ""}
                  </span>
                  <span>{formatCurrency(row.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
