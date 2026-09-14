"use client";

import { AppShell } from "@/components/AppShell";
import { SlipServiceEntry } from "@/components/SlipServiceEntry";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SlipServicePage() {
  const router = useRouter();
  const { role, isLoggedIn, loaded } = useAuth();

  useEffect(() => {
    if (!loaded) return;
    if (!isLoggedIn || (role !== "reception" && role !== "admin")) {
      router.replace("/dashboard");
    }
  }, [loaded, isLoggedIn, role, router]);

  if (!loaded) {
    return (
      <AppShell>
        <p className="text-center text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  if (!isLoggedIn || (role !== "reception" && role !== "admin")) {
    return null;
  }

  return (
    <AppShell>
      <SlipServiceEntry />
    </AppShell>
  );
}
