"use client";

import { AdminTabs, AdminTab } from "@/components/AdminTabs";
import { AppShell } from "@/components/AppShell";
import { CreatableSelect } from "@/components/CreatableSelect";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<AdminTab>("technicians");
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const requested = searchParams.get("tab");
    if (
      requested === "technicians" ||
      requested === "appliances" ||
      requested === "customers" ||
      requested === "reports"
    ) {
      setTab(requested);
    }
  }, [searchParams]);

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
      <PageHeader title="Admin" description="Technicians, appliances, customers, and reports" />
      <AdminTabs active={tab} onChange={setTab} />
      {tab === "technicians" && <TechniciansTab />}
      {tab === "appliances" && <AppliancesTab />}
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

type ApplianceOption = { id: string; value: string };

function AppliancesTab() {
  const [appliances, setAppliances] = useState<ApplianceOption[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/lookups?category=appliance");
    setAppliances(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addAppliance() {
    if (!newName.trim()) return;
    const res = await fetch("/api/lookups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "appliance", value: newName.trim() }),
    });
    if (res.ok) {
      setNewName("");
      load();
    } else {
      const data = await res.json();
      alert(data.error ?? "Add failed");
    }
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    const res = await fetch(`/api/lookups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: editName.trim() }),
    });
    if (res.ok) {
      setEditingId(null);
      load();
    } else {
      const data = await res.json();
      alert(data.error ?? "Update failed");
    }
  }

  async function deleteAppliance(id: string, name: string) {
    if (!confirm(`Remove appliance "${name}" from the list?`)) return;
    const res = await fetch(`/api/lookups/${id}`, { method: "DELETE" });
    if (res.ok) {
      load();
    } else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appliance Types</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">
          Edit or remove appliance types shown when creating jobs. Renaming updates
          existing jobs and technician routing.
        </p>
        <ul className="space-y-2">
          {appliances.map((a) => (
            <li
              key={a.id}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              {editingId === a.id ? (
                <div className="flex gap-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded border border-slate-300 px-2 py-1"
                    autoFocus
                  />
                  <button
                    onClick={() => saveEdit(a.id)}
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
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{a.value}</span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setEditingId(a.id);
                        setEditName(a.value);
                      }}
                      className="rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteAppliance(a.id, a.value)}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {appliances.length === 0 && (
            <p className="text-sm text-slate-500">No appliances yet.</p>
          )}
        </ul>
        <div className="flex gap-2 border-t border-slate-100 pt-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New appliance type"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAppliance();
              }
            }}
          />
          <button
            onClick={addAppliance}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Add
          </button>
        </div>
      </CardContent>
    </Card>
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
  const [period, setPeriod] = useState<"today" | "month" | "year">("today");
  const [reportSection, setReportSection] = useState<
    "summary" | "technicians" | "brands-appliances"
  >("summary");
  const [summary, setSummary] = useState<{
    summary: {
      jobsReceived: number;
      jobsDelivered: number;
      totalJobs: number;
      totalCollection: number;
    };
    pendingAging: { over3Days: number; over7Days: number; over15Days: number };
    readyNotDelivered: { count: number; totalAmount: number };
  } | null>(null);
  const [technicianData, setTechnicianData] = useState<{
    assignedWorkloadReports: Array<{
      name: string;
      totalAssigned: number;
      pending: number;
      ready: number;
      waitingForApproval: number;
      return: number;
    }>;
    completedByReports: Array<{
      name: string;
      totalCompletedJobs: number;
      totalCollection: number;
      averageBill: number;
      lowestBill: number;
      highestBill: number;
    }>;
  } | null>(null);
  const [brandData, setBrandData] = useState<{
    applianceReports: Array<{
      applianceType: string;
      totalJobs: number;
      totalCollection: number;
      averageServiceAmount: number;
    }>;
    brandReports: Array<{
      brand: string;
      totalJobs: number;
      totalCollection: number;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/reports/service?period=${period}&section=summary`)
      .then((r) => r.json())
      .then(setSummary)
      .finally(() => setLoading(false));
    setTechnicianData(null);
    setBrandData(null);
    if (reportSection === "technicians") {
      fetch(`/api/admin/reports/service?period=${period}&section=technicians`)
        .then((r) => r.json())
        .then(setTechnicianData);
    } else if (reportSection === "brands-appliances") {
      fetch(`/api/admin/reports/service?period=${period}&section=brands-appliances`)
        .then((r) => r.json())
        .then(setBrandData);
    }
  }, [period]);

  useEffect(() => {
    if (reportSection === "technicians" && !technicianData) {
      fetch(`/api/admin/reports/service?period=${period}&section=technicians`)
        .then((r) => r.json())
        .then(setTechnicianData);
    }
    if (reportSection === "brands-appliances" && !brandData) {
      fetch(`/api/admin/reports/service?period=${period}&section=brands-appliances`)
        .then((r) => r.json())
        .then(setBrandData);
    }
  }, [reportSection, period, technicianData, brandData]);

  const formatRs = (n: number) =>
    `Rs.${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {(
          [
            { id: "today", label: "Today" },
            { id: "month", label: "This Month" },
            { id: "year", label: "This Year" },
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

      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {(
          [
            { id: "summary", label: "Overview" },
            { id: "technicians", label: "Technicians" },
            { id: "brands-appliances", label: "Brands & Appliances" },
          ] as const
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setReportSection(s.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              reportSection === s.id
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading && !summary && (
        <p className="text-center text-slate-500">Loading reports…</p>
      )}

      {reportSection === "summary" && summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={period === "today" ? "Jobs Received Today" : "Total Jobs"}
              value={
                period === "today" ? summary.summary.jobsReceived : summary.summary.totalJobs
              }
            />
            <StatCard
              label={period === "today" ? "Delivered Today" : "Jobs Delivered"}
              value={summary.summary.jobsDelivered}
            />
            <StatCard
              label="Total Collection"
              value={formatRs(summary.summary.totalCollection)}
              valueClassName="text-emerald-800"
            />
            <StatCard
              label="Ready (Not Delivered)"
              value={summary.readyNotDelivered.count}
              subtext={formatRs(summary.readyNotDelivered.totalAmount)}
              href="/jobs/search?status=Ready"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending Aging</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
              <div className="rounded-md bg-amber-50 p-3">
                <p className="text-slate-600">&gt; 3 days</p>
                <p className="text-xl font-bold text-amber-800">
                  {summary.pendingAging.over3Days}
                </p>
              </div>
              <div className="rounded-md bg-orange-50 p-3">
                <p className="text-slate-600">&gt; 7 days</p>
                <p className="text-xl font-bold text-orange-800">
                  {summary.pendingAging.over7Days}
                </p>
              </div>
              <div className="rounded-md bg-red-50 p-3">
                <p className="text-slate-600">&gt; 15 days</p>
                <p className="text-xl font-bold text-red-800">
                  {summary.pendingAging.over15Days}
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {reportSection === "technicians" && (
        <>
          {!technicianData ? (
            <p className="text-center text-slate-500">Loading technician reports…</p>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assigned Workload</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-2 pr-4">Technician</th>
                        <th className="pb-2 pr-4">Assigned</th>
                        <th className="pb-2 pr-4">Pending</th>
                        <th className="pb-2 pr-4">Ready</th>
                        <th className="pb-2 pr-4">Waiting</th>
                        <th className="pb-2">Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {technicianData.assignedWorkloadReports.map((row) => (
                        <tr key={row.name} className="border-b border-slate-100">
                          <td className="py-2 pr-4 font-medium">{row.name}</td>
                          <td className="py-2 pr-4">{row.totalAssigned}</td>
                          <td className="py-2 pr-4">{row.pending}</td>
                          <td className="py-2 pr-4">{row.ready}</td>
                          <td className="py-2 pr-4">{row.waitingForApproval}</td>
                          <td className="py-2">{row.return}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Completed By Technician</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-2 pr-4">Technician</th>
                        <th className="pb-2 pr-4">Completed</th>
                        <th className="pb-2 pr-4">Collection</th>
                        <th className="pb-2 pr-4">Avg Bill</th>
                        <th className="pb-2 pr-4">Lowest</th>
                        <th className="pb-2">Highest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {technicianData.completedByReports.map((row) => (
                        <tr key={row.name} className="border-b border-slate-100">
                          <td className="py-2 pr-4 font-medium">{row.name}</td>
                          <td className="py-2 pr-4">{row.totalCompletedJobs}</td>
                          <td className="py-2 pr-4">{formatRs(row.totalCollection)}</td>
                          <td className="py-2 pr-4">{formatRs(Math.round(row.averageBill))}</td>
                          <td className="py-2 pr-4">{formatRs(row.lowestBill)}</td>
                          <td className="py-2">{formatRs(row.highestBill)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {reportSection === "brands-appliances" && (
        <>
          {!brandData ? (
            <p className="text-center text-slate-500">Loading brand & appliance reports…</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Appliance-wise</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {brandData.applianceReports.map((row) => (
                    <div key={row.applianceType} className="flex justify-between gap-2">
                      <span className="text-slate-700">{row.applianceType}</span>
                      <span className="text-right text-slate-900">
                        {row.totalJobs} jobs · {formatRs(row.totalCollection)} · avg{" "}
                        {formatRs(Math.round(row.averageServiceAmount))}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Brand-wise</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {brandData.brandReports.map((row) => (
                    <div key={row.brand} className="flex justify-between">
                      <span className="text-slate-700">{row.brand}</span>
                      <span className="font-semibold text-slate-900">
                        {row.totalJobs} · {formatRs(row.totalCollection)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
