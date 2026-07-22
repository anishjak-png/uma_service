"use client";

import Link from "next/link";
import { SHOP_NAME } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (!res.ok) {
      if (res.status === 401) {
        setError("Invalid PIN. Try again.");
      } else {
        setError("Sign-in failed. Please refresh the page and try again.");
      }
      setLoading(false);
      return;
    }

    const data = await res.json();
    setLoading(false);
    router.push(data.role === "technician" ? "/technician/select" : "/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-emerald-800">{SHOP_NAME}</CardTitle>
          <p className="text-sm text-slate-500">Job Card System</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="pin"
                className="text-sm font-medium text-slate-700"
              >
                Staff PIN
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                className="flex h-14 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-2xl tracking-widest placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                autoFocus
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || !pin}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            Reception · Technician · Admin
          </p>
          <p className="mt-3 text-center text-sm">
            <Link href="/track" className="font-medium text-emerald-700 hover:underline">
              Customer? Track your job status
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
