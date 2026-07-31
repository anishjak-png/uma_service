"use client";

import { SHOP_NAME } from "@/lib/constants";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DevicePendingPage() {
  const router = useRouter();
  const { isLoggedIn, deviceApproved, role, loaded, refreshAuth } = useAuth();

  useEffect(() => {
    if (!loaded) return;
    if (!isLoggedIn) {
      router.replace("/");
      return;
    }
    if (deviceApproved) {
      router.replace(role === "technician" ? "/jobs/pending" : "/dashboard");
    }
  }, [loaded, isLoggedIn, deviceApproved, role, router]);

  useEffect(() => {
    if (!loaded || !isLoggedIn || deviceApproved) return;

    const interval = setInterval(() => {
      void refreshAuth();
    }, 15000);

    return () => clearInterval(interval);
  }, [loaded, isLoggedIn, deviceApproved, refreshAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-amber-800">{SHOP_NAME}</CardTitle>
          <p className="text-sm text-slate-500">Waiting for device approval</p>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-2xl">
            ⏳
          </div>
          <p className="text-sm text-slate-600">
            Your login was successful, but this device must be approved by an
            admin before you can use the app.
          </p>
          <p className="text-xs text-slate-400">
            This page checks every 15 seconds. Ask admin to approve your device
            in Admin → Devices.
          </p>
          <button
            type="button"
            onClick={() => refreshAuth()}
            className="inline-flex h-11 w-full items-center justify-center rounded-md border border-amber-300 bg-white text-sm font-medium text-amber-800 hover:bg-amber-50"
          >
            Check again now
          </button>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              await refreshAuth();
              router.replace("/");
            }}
            className="text-sm text-slate-500 underline-offset-2 hover:underline"
          >
            Sign out
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
