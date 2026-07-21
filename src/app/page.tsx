"use client";

import { SHOP_NAME } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

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
      setError("Invalid PIN. Try again.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setLoading(false);
    router.push(data.role === "technician" ? "/technician/select" : "/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-b from-orange-500 to-orange-700 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-2xl font-bold text-orange-600">
            U
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{SHOP_NAME}</h1>
          <p className="mt-1 text-sm text-gray-500">Job Card System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pin" className="mb-1 block text-sm font-medium text-gray-700">
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
              className="w-full rounded-xl border border-gray-300 px-4 py-4 text-center text-2xl tracking-widest focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              autoFocus
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !pin}
            className="w-full rounded-xl bg-orange-600 py-4 text-lg font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Reception · Technician · Admin
        </p>
      </div>
    </div>
  );
}
