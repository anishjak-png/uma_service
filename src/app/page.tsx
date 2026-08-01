"use client";

import Link from "next/link";
import { SHOP_NAME } from "@/lib/constants";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getDeviceIdentity } from "@/lib/device-identity";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { refreshAuth, isLoggedIn, deviceApproved, role, loaded } = useAuth();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    if (!isLoggedIn) return;
    if (!deviceApproved) {
      router.replace("/device-pending");
      return;
    }
    router.replace(role === "technician" ? "/jobs/pending?scope=my" : "/dashboard");
  }, [loaded, isLoggedIn, deviceApproved, role, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const identity = await getDeviceIdentity();

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mobile,
        password,
        deviceId: identity.deviceId,
        deviceLabel: identity.deviceLabel,
        platform: identity.platform,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 403 && data.error === "device_pending") {
      await refreshAuth();
      setLoading(false);
      router.push("/device-pending");
      router.refresh();
      return;
    }

    if (res.status === 403 && data.error === "device_revoked") {
      setError("This device was revoked. Contact admin.");
      setLoading(false);
      return;
    }

    if (!res.ok) {
      if (res.status === 401) {
        setError("Invalid mobile or password.");
      } else {
        setError(data.error ?? "Sign-in failed. Please try again.");
      }
      setLoading(false);
      return;
    }

    await refreshAuth();
    setLoading(false);
    router.push(data.role === "technician" ? "/jobs/pending?scope=my" : "/dashboard");
    router.refresh();
  }

  if (!loaded || isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 p-4">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
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
                htmlFor="mobile"
                className="text-sm font-medium text-slate-700"
              >
                Mobile number
              </label>
              <input
                id="mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="username"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit mobile"
                className="flex h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-lg tracking-wide placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="flex h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-lg placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || !mobile || !password}
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-400">
            New device? Admin must approve after first login.
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
