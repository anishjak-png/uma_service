"use client";

import { useAuth } from "@/components/AuthProvider";
import { SHOP_NAME } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Technician = { id: string; name: string };

export default function TechnicianSelectPage() {
  const router = useRouter();
  const { role, isLoggedIn, technicianId, loaded: authLoaded } = useAuth();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoaded) return;

    if (!isLoggedIn || role !== "technician") {
      router.push("/");
      return;
    }

    if (technicianId) {
      router.push("/jobs/pending");
      return;
    }

    fetch("/api/technicians")
      .then((r) => r.json())
      .then((data) => {
        setTechnicians(data);
        setLoading(false);
      });
  }, [authLoaded, isLoggedIn, role, technicianId, router]);

  async function selectTechnician(technicianId: string) {
    await fetch("/api/auth/technician-select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ technicianId }),
    });
    router.push("/jobs/pending");
    router.refresh();
  }

  async function goBack() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-emerald-50 to-slate-100 p-4">
      <div className="mx-auto w-full max-w-md pt-2">
        <button
          type="button"
          onClick={goBack}
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          ← Back to login
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-emerald-800">{SHOP_NAME}</CardTitle>
            <p className="text-sm text-slate-500">Who is working today?</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {technicians.map((tech) => (
              <button
                key={tech.id}
                onClick={() => selectTechnician(tech.id)}
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                {tech.name}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
