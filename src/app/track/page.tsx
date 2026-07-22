"use client";

import { SHOP_NAME } from "@/lib/constants";
import { formatMobileDisplay } from "@/lib/jobs";
import { FormEvent, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type TrackResult = {
  jobNumber: string;
  applianceType: string;
  brand: string;
  model?: string | null;
  statusLabel: string;
};

export default function TrackPage() {
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TrackResult[] | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResults(null);

    const digits = mobile.replace(/\D/g, "").slice(-10);
    const res = await fetch(`/api/track?mobile=${digits}`);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Could not find jobs");
      setLoading(false);
      return;
    }

    setResults(data);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-emerald-800">{SHOP_NAME}</CardTitle>
          <p className="text-sm text-slate-500">Track your service status</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="mobile" className="text-sm font-medium text-slate-700">
                Mobile Number
              </label>
              <input
                id="mobile"
                type="tel"
                inputMode="numeric"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Enter registered mobile number"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Searching..." : "Track Status"}
            </button>
          </form>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {results && results.length === 0 && (
            <p className="text-center text-sm text-slate-500">
              No jobs found for {formatMobileDisplay(mobile)}
            </p>
          )}

          {results && results.length > 0 && (
            <div className="space-y-2">
              {results.map((job) => (
                <div
                  key={job.jobNumber}
                  className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
                >
                  <p className="font-semibold text-slate-900">{job.jobNumber}</p>
                  <p className="text-slate-600">{job.applianceType}</p>
                  <p className="text-slate-600">
                    {job.brand}
                    {job.model ? ` · ${job.model}` : ""}
                  </p>
                  <p className="mt-1 font-medium text-emerald-700">{job.statusLabel}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
