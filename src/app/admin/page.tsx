"use client";

import { AdminTabs, AdminTab } from "@/components/AdminTabs";
import { AppShell } from "@/components/AppShell";
import { CreatableSelect } from "@/components/CreatableSelect";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Technician = {
  id: string;
  name: string;
  applianceMappings: Array<{ applianceType: string }>;
};

type Mapping = {
  applianceType: string;
  technicianId: string;
  technician: { id: string; name: string };
};

type Customer = {
  id: string;
  name: string | null;
  mobile: string;
  address: string | null;
  jobCount: number;
};

type BillingReport = {
  period: string;
  pending: { count: number; total: number };
  delivered: { count: number; total: number };
  serviced: { count: number; total: number };
};

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("technicians");
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.isLoggedIn || data.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        setAuthorized(true);
      });
  }, [router]);

  if (authorized === null) {
    return (
      <AppShell>
        <p className="text-center text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  if (!authorized) return null;

  return (
    <AppShell>
      <PageHeader title="Admin" description="Technicians, customers, and reports" />
      <AdminTabs active={tab} onChange={setTab} />
      {tab === "technicians" && <TechniciansTab />}
      {tab === "customers" && <CustomersTab />}
      {tab === "reports" && <ReportsTab />}
    </AppShell>
  );
}

function TechniciansTab() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [newTechName, setNewTechName] = useState("");
  const [selectedAppliance, setSelectedAppliance] = useState("");
  const [selectedTechId, setSelectedTechId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    const [techRes, mapRes] = await Promise.all([
      fetch("/api/technicians"),
      fetch("/api/appliance-technicians"),
    ]);
    setTechnicians(await techRes.json());
    setMappings(await mapRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addTechnician() {
    if (!newTechName.trim()) return;
    await fetch("/api/technicians", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTechName.trim() }),
    });
    setNewTechName("");
    load();
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    const res = await fetch(`/api/technicians/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (res.ok) {
      setEditingId(null);
      load();
    } else {
      const data = await res.json();
      alert(data.error ?? "Update failed");
    }
  }

  async function deleteTechnician(id: string, name: string) {
    if (!confirm(`Remove technician "${name}"?`)) return;
    const res = await fetch(`/api/technicians/${id}`, { method: "DELETE" });
    if (res.ok) {
      load();
    } else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
  }

  async function saveMapping() {
    if (!selectedAppliance || !selectedTechId) return;
    await fetch("/api/appliance-technicians", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applianceType: selectedAppliance,
        technicianId: selectedTechId,
      }),
    });
    setSelectedAppliance("");
    setSelectedTechId("");
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Technicians</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {technicians.map((t) => (
              <li
                key={t.id}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                {editingId === t.id ? (
                  <div className="flex gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded border border-slate-300 px-2 py-1"
                    />
                    <button
                      onClick={() => saveEdit(t.id)}
                      className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{t.name}</p>
                        {t.applianceMappings.length > 0 && (
                          <p className="text-xs text-slate-500">
                            {t.applianceMappings
                              .map((m) => m.applianceType)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => {
                            setEditingId(t.id);
                            setEditName(t.name);
                          }}
                          className="rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTechnician(t.id, t.name)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTechName}
              onChange={(e) => setNewTechName(e.target.value)}
              placeholder="New technician name"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={addTechnician}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Add
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appliance Routing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-500">
            New jobs auto-assign to the mapped technician.
          </p>
          <CreatableSelect
            category="appliance"
            label="Appliance Type"
            value={selectedAppliance}
            onChange={setSelectedAppliance}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Default Technician
            </label>
            <select
              value={selectedTechId}
              onChange={(e) => setSelectedTechId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select technician</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={saveMapping}
            disabled={!selectedAppliance || !selectedTechId}
            className="w-full rounded-md bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save Routing
          </button>
          {mappings.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              {mappings.map((m) => (
                <div
                  key={m.applianceType}
                  className="flex justify-between text-sm text-slate-700"
                >
                  <span>{m.applianceType}</span>
                  <span className="font-medium">{m.technician.name}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CustomersTab() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", mobile: "", address: "" });

  const search = useCallback(async (q: string) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    const res = await fetch(`/api/customers${params}`);
    setCustomers(await res.json());
  }, []);

  useEffect(() => {
    search("");
  }, [search]);

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name ?? "",
      mobile: c.mobile,
      address: c.address ?? "",
    });
  }

  async function saveCustomer() {
    if (!editing) return;
    const res = await fetch(`/api/customers/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setEditing(null);
      search(query);
    } else {
      const data = await res.json();
      alert(data.error ?? "Save failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(query);
          }}
          className="flex gap-2"
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mobile or name"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Search
          </button>
        </form>

        <ul className="space-y-2">
          {customers.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => openEdit(c)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
              >
                <p className="font-medium text-slate-900">
                  {c.name ?? c.mobile}
                </p>
                <p className="text-slate-500">{c.mobile}</p>
                <p className="text-xs text-slate-400">
                  {c.jobCount} job(s)
                  {c.address ? ` · ${c.address}` : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>

        {editing && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
              <h3 className="mb-4 font-semibold text-slate-900">Edit Customer</h3>
              <div className="space-y-3">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Name"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  placeholder="Mobile"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="Address"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <Link
                  href={`/jobs/search?q=${editing.mobile}`}
                  className="block text-sm font-medium text-emerald-700 hover:underline"
                >
                  View {editing.jobCount} job(s)
                </Link>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={saveCustomer}
                  className="flex-1 rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 rounded-md border border-slate-300 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportsTab() {
  const [period, setPeriod] = useState<"today" | "month" | "all">("month");
  const [report, setReport] = useState<BillingReport | null>(null);

  useEffect(() => {
    fetch(`/api/admin/reports/billing?period=${period}`)
      .then((r) => r.json())
      .then(setReport);
  }, [period]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {(
          [
            { id: "today", label: "Today" },
            { id: "month", label: "This month" },
            { id: "all", label: "All time" },
          ] as const
        ).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              period === p.id
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {report && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Pending Bill"
            value={formatCurrency(report.pending.total)}
            subtext={`${report.pending.count} ready job(s)`}
            href="/jobs/search?status=Ready"
            valueClassName="text-orange-700"
          />
          <StatCard
            label="Delivered Bill"
            value={formatCurrency(report.delivered.total)}
            subtext={`${report.delivered.count} delivered`}
            href="/jobs/search?status=Delivered"
            valueClassName="text-emerald-700"
          />
          <StatCard
            label="Total Serviced"
            value={formatCurrency(report.serviced.total)}
            subtext={`${report.serviced.count} job(s) with bill`}
            valueClassName="text-blue-700"
          />
        </div>
      )}
    </div>
  );
}
