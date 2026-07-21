"use client";

import { SHOP_NAME } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Technician = { id: string; name: string };

export default function TechnicianSelectPage() {
  const router = useRouter();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/api/auth/me");
      const me = await meRes.json();

      if (!me.isLoggedIn || me.role !== "technician") {
        router.push("/");
        return;
      }

      if (me.technicianId) {
        router.push("/jobs/pending");
        return;
      }

      const res = await fetch("/api/technicians");
      setTechnicians(await res.json());
      setLoading(false);
    }
    init();
  }, [router]);

  async function selectTechnician(technicianId: string) {
    await fetch("/api/auth/technician-select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ technicianId }),
    });
    router.push("/jobs/pending");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-b from-orange-500 to-orange-700 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-center text-xl font-bold text-gray-900">{SHOP_NAME}</h1>
        <p className="mt-1 text-center text-sm text-gray-500">Who is working today?</p>

        <div className="mt-6 space-y-2">
          {technicians.map((tech) => (
            <button
              key={tech.id}
              onClick={() => selectTechnician(tech.id)}
              className="w-full rounded-xl bg-orange-600 py-4 text-lg font-semibold text-white hover:bg-orange-700"
            >
              {tech.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
