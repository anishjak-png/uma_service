"use client";

import { AdminTabs, AdminTab, AdminSettingsTab } from "@/components/AdminTabs";
import { AppShell } from "@/components/AppShell";
import { CreatableSelect } from "@/components/CreatableSelect";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { WhatsAppAutomationTab } from "./WhatsAppAutomationTab";
import { StaffTab } from "./StaffTab";
import { DevicesTab } from "./DevicesTab";
import { reportJobsHref } from "@/lib/report-links";
import type { ReportPeriod } from "@/lib/reports";

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
  allowWhatsappNotifications: boolean;
  jobCount: number;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data;
}

export default function AdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, isLoggedIn, loaded: authLoaded, pendingDeviceCount } = useAuth();

  const tabFromUrl = searchParams.get("tab");
  const initialTab: AdminTab =
    tabFromUrl === "reports" ||
    tabFromUrl === "devices" ||
    tabFromUrl === "staff" ||
    tabFromUrl === "technicians" ||
    tabFromUrl === "appliances" ||
    tabFromUrl === "customers" ||
    tabFromUrl === "whatsapp"
      ? tabFromUrl
      : "devices";

  const [tab, setTab] = useState<AdminTab>(initialTab);

  useEffect(() => {
    const requested = searchParams.get("tab");
    if (
      requested === "devices" ||
      requested === "staff" ||
      requested === "technicians" ||
      requested === "appliances" ||
      requested === "customers" ||
      requested === "whatsapp" ||
      requested === "reports"
    ) {
      setTab(requested);
    } else if (!requested) {
      setTab("devices");
    }
  }, [searchParams]);

  function handleTabChange(next: AdminTab) {
    setTab(next);
    router.replace(`/admin?tab=${next}`, { scroll: false });
  }

  function handleSettingsTabChange(next: AdminSettingsTab) {
    handleTabChange(next);
  }

  useEffect(() => {
    if (!authLoaded) return;
    if (!isLoggedIn || role !== "admin") {
      router.push("/dashboard");
    }
  }, [authLoaded, isLoggedIn, role, router]);

  if (!authLoaded) {
    return (
      <AppShell>
        <p className="text-center text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  if (!isLoggedIn || role !== "admin") return null;

  return (
    <AppShell>
      {tab !== "reports" && (
        <AdminTabs
          active={tab as AdminSettingsTab}
          onChange={handleSettingsTabChange}
          pendingDeviceCount={pendingDeviceCount}
        />
      )}
      {tab === "devices" && <DevicesTab />}
      {tab === "staff" && <StaffTab />}
      {tab === "technicians" && <TechniciansTab />}
      {tab === "appliances" && <AppliancesTab />}
      {tab === "customers" && <CustomersTab />}
      {tab === "whatsapp" && <WhatsAppAutomationTab />}
      {tab === "reports" && <ReportsTab />}
    </AppShell>
  );
}

function TechniciansTab() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loadError, setLoadError] = useState("");
  const [newTechName, setNewTechName] = useState("");
  const [selectedAppliance, setSelectedAppliance] = useState("");
  const [selectedTechId, setSelectedTechId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [techs, maps] = await Promise.all([
        fetchJson<Technician[]>("/api/technicians"),
        fetchJson<Mapping[]>("/api/appliance-technicians"),
      ]);
      setTechnicians(techs);
      setMappings(maps);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load technicians"
      );
    }
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
      {loadError ? (
        <p className="col-span-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      ) : null}
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
  const [loadError, setLoadError] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [selectedAppliance, setSelectedAppliance] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [complaints, setComplaints] = useState<string[]>([]);
  const [lookupError, setLookupError] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newComplaint, setNewComplaint] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      setAppliances(
        await fetchJson<ApplianceOption[]>("/api/lookups?category=appliance")
      );
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load appliances"
      );
    }
  }, []);

  const loadProductLookups = useCallback(async (applianceType: string) => {
    if (!applianceType) {
      setBrands([]);
      setComplaints([]);
      return;
    }

    setLookupError("");
    try {
      const data = await fetchJson<{ brands: string[]; complaints: string[] }>(
        `/api/appliance-lookups?applianceType=${encodeURIComponent(applianceType)}`
      );
      setBrands(data.brands ?? []);
      setComplaints(data.complaints ?? []);
    } catch (error) {
      setLookupError(
        error instanceof Error ? error.message : "Failed to load brands and complaints"
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadProductLookups(selectedAppliance);
  }, [selectedAppliance, loadProductLookups]);

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
      const data = await res.json().catch(() => ({}));
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
      const previousName = appliances.find((a) => a.id === id)?.value;
      setEditingId(null);
      load();
      if (previousName && selectedAppliance === previousName) {
        setSelectedAppliance(editName.trim());
      }
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Update failed");
    }
  }

  async function deleteAppliance(id: string, name: string) {
    if (!confirm(`Remove appliance "${name}" from the list?`)) return;
    const res = await fetch(`/api/lookups/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedAppliance === name) {
        setSelectedAppliance("");
      }
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Delete failed");
    }
  }

  async function addLookup(category: "brand" | "complaint", value: string) {
    if (!selectedAppliance || !value.trim()) return;

    const res = await fetch("/api/appliance-lookups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applianceType: selectedAppliance,
        category,
        value: value.trim(),
      }),
    });

    if (res.ok) {
      if (category === "brand") setNewBrand("");
      else setNewComplaint("");
      loadProductLookups(selectedAppliance);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Add failed");
    }
  }

  async function removeLookup(category: "brand" | "complaint", value: string) {
    if (!selectedAppliance) return;

    const res = await fetch("/api/appliance-lookups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applianceType: selectedAppliance,
        category,
        value,
      }),
    });

    if (res.ok) {
      loadProductLookups(selectedAppliance);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Remove failed");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {loadError ? (
        <p className="col-span-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Product Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-500">
            Edit or remove product types shown when creating jobs. Renaming updates
            existing jobs, technician routing, and brand/complaint mappings.
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
                    <button
                      type="button"
                      onClick={() => setSelectedAppliance(a.value)}
                      className={`text-left font-medium ${
                        selectedAppliance === a.value
                          ? "text-emerald-700"
                          : "text-slate-900"
                      }`}
                    >
                      {a.value}
                    </button>
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
              <p className="text-sm text-slate-500">No product types yet.</p>
            )}
          </ul>
          <div className="flex gap-2 border-t border-slate-100 pt-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New product type"
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

      <Card>
        <CardHeader>
          <CardTitle>Brands & Complaints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-500">
            Select a product type on the left, then assign which brands and complaints
            appear when creating jobs for that product.
          </p>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Product Type
            </label>
            <select
              value={selectedAppliance}
              onChange={(e) => setSelectedAppliance(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select product type</option>
              {appliances.map((a) => (
                <option key={a.id} value={a.value}>
                  {a.value}
                </option>
              ))}
            </select>
          </div>

          {lookupError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {lookupError}
            </p>
          ) : null}

          {selectedAppliance ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Brands</p>
                <ul className="space-y-1">
                  {brands.map((brand) => (
                    <li
                      key={brand}
                      className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm"
                    >
                      <span>{brand}</span>
                      <button
                        onClick={() => removeLookup("brand", brand)}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                  {brands.length === 0 && (
                    <p className="text-sm text-slate-500">No brands assigned yet.</p>
                  )}
                </ul>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="Add brand"
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLookup("brand", newBrand);
                      }
                    }}
                  />
                  <button
                    onClick={() => addLookup("brand", newBrand)}
                    className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700">Complaints</p>
                <ul className="space-y-1">
                  {complaints.map((complaint) => (
                    <li
                      key={complaint}
                      className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm"
                    >
                      <span>{complaint}</span>
                      <button
                        onClick={() => removeLookup("complaint", complaint)}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                  {complaints.length === 0 && (
                    <p className="text-sm text-slate-500">No complaints assigned yet.</p>
                  )}
                </ul>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComplaint}
                    onChange={(e) => setNewComplaint(e.target.value)}
                    placeholder="Add complaint"
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLookup("complaint", newComplaint);
                      }
                    }}
                  />
                  <button
                    onClick={() => addLookup("complaint", newComplaint)}
                    className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Add
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Select a product type to manage its brands and complaints.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CustomersTab() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    address: "",
    allowWhatsappNotifications: true,
  });

  const search = useCallback(async (q: string) => {
    setLoadError("");
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      setCustomers(await fetchJson<Customer[]>(`/api/customers${params}`));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load customers"
      );
    }
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
      allowWhatsappNotifications: c.allowWhatsappNotifications,
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
        {loadError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {loadError}
          </p>
        ) : null}
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
                  {!c.allowWhatsappNotifications ? " · WhatsApp off" : ""}
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
                <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-700">WhatsApp notifications</span>
                  <input
                    type="checkbox"
                    checked={form.allowWhatsappNotifications}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        allowWhatsappNotifications: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </label>
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

function ReportLinkCard({
  href,
  className = "bg-white",
  label,
  value,
  subtext,
}: {
  href: string;
  className?: string;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-md p-3 transition-colors hover:opacity-90 ${className}`}
    >
      <p className="text-slate-600">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {subtext ? <p className="text-xs text-slate-500">{subtext}</p> : null}
    </Link>
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
    technicianReports: Array<{
      id: string;
      name: string;
      received: number;
      pending: number;
      waitingForApproval: number;
      ready: number;
      return: number;
      activeAssigned: number;
      completed: number;
      delivered: number;
      totalCollection: number;
      averageBill: number;
      lowestBill: number;
      highestBill: number;
      completionRate: number | null;
    }>;
    totals: {
      received: number;
      pending: number;
      waitingForApproval: number;
      ready: number;
      return: number;
      activeAssigned: number;
      completed: number;
      delivered: number;
      totalCollection: number;
    };
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/admin/reports/service?period=${period}&section=summary`
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load reports");
        }
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) {
          setSummary(null);
          setError(err instanceof Error ? err.message : "Failed to load reports");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSummary();
    setTechnicianData(null);
    setBrandData(null);

    return () => {
      cancelled = true;
    };
  }, [period]);

  useEffect(() => {
    if (reportSection === "technicians" && !technicianData) {
      fetch(`/api/admin/reports/service?period=${period}&section=technicians`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Failed to load technician reports");
          setTechnicianData(data);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load technician reports");
        });
    }
    if (reportSection === "brands-appliances" && !brandData) {
      fetch(`/api/admin/reports/service?period=${period}&section=brands-appliances`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Failed to load brand reports");
          setBrandData(data);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load brand reports");
        });
    }
  }, [reportSection, period, technicianData, brandData]);

  const formatRs = (n: number) =>
    `Rs.${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const periodFilter = period as ReportPeriod;

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

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {loading && reportSection === "summary" && !summary && !error && (
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
              href={reportJobsHref({ receivedPeriod: periodFilter })}
            />
            <StatCard
              label={period === "today" ? "Delivered Today" : "Jobs Delivered"}
              value={summary.summary.jobsDelivered}
              href={reportJobsHref({ deliveredPeriod: periodFilter })}
            />
            <StatCard
              label="Total Collection"
              value={formatRs(summary.summary.totalCollection)}
              valueClassName="text-emerald-800"
              href={reportJobsHref({ deliveredPeriod: periodFilter })}
            />
            <StatCard
              label="Ready (Not Delivered)"
              value={summary.readyNotDelivered.count}
              subtext={formatRs(summary.readyNotDelivered.totalAmount)}
              href={reportJobsHref({ status: "Ready" })}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending Aging</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
              <ReportLinkCard
                href={reportJobsHref({ status: "Pending", minAgeDays: 3 })}
                className="bg-amber-50"
                label="> 3 days"
                value={summary.pendingAging.over3Days}
              />
              <ReportLinkCard
                href={reportJobsHref({ status: "Pending", minAgeDays: 7 })}
                className="bg-orange-50"
                label="> 7 days"
                value={summary.pendingAging.over7Days}
              />
              <ReportLinkCard
                href={reportJobsHref({ status: "Pending", minAgeDays: 15 })}
                className="bg-red-50"
                label="> 15 days"
                value={summary.pendingAging.over15Days}
              />
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Received (Assigned)"
                  value={technicianData.totals.received}
                  subtext={
                    period === "today"
                      ? "Jobs received today"
                      : period === "month"
                        ? "This month"
                        : "This year"
                  }
                  href={reportJobsHref({ receivedPeriod: periodFilter })}
                />
                <StatCard
                  label="Active Pipeline"
                  value={technicianData.totals.activeAssigned}
                  subtext={`${technicianData.totals.pending} pending · ${technicianData.totals.ready} ready`}
                  href={reportJobsHref({ active: true })}
                />
                <StatCard
                  label="Completed (Ready)"
                  value={technicianData.totals.completed}
                  subtext="Marked ready in period"
                  href={reportJobsHref({ readyPeriod: periodFilter })}
                />
                <StatCard
                  label="Delivered Collection"
                  value={formatRs(technicianData.totals.totalCollection)}
                  subtext={`${technicianData.totals.delivered} delivered`}
                  valueClassName="text-emerald-800"
                  href={reportJobsHref({ deliveredPeriod: periodFilter })}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Technician-wise Analysis</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <p className="mb-3 text-xs text-slate-500">
                    Received and completed/delivered counts use the selected period.
                    Pending, ready, and return show current assigned backlog.
                  </p>
                  <table className="w-full min-w-[960px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-2 pr-3">Technician</th>
                        <th className="pb-2 pr-3">Received</th>
                        <th className="pb-2 pr-3">Pending</th>
                        <th className="pb-2 pr-3">Waiting</th>
                        <th className="pb-2 pr-3">Ready</th>
                        <th className="pb-2 pr-3">Return</th>
                        <th className="pb-2 pr-3">Active</th>
                        <th className="pb-2 pr-3">Completed</th>
                        <th className="pb-2 pr-3">Delivered</th>
                        <th className="pb-2 pr-3">Collection</th>
                        <th className="pb-2 pr-3">Avg Bill</th>
                        <th className="pb-2 pr-3">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {technicianData.technicianReports.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3 font-medium text-slate-900">
                            {row.name}
                          </td>
                          <td className="py-2 pr-3">{row.received}</td>
                          <td className="py-2 pr-3 text-amber-700">{row.pending}</td>
                          <td className="py-2 pr-3">{row.waitingForApproval}</td>
                          <td className="py-2 pr-3 text-emerald-700">{row.ready}</td>
                          <td className="py-2 pr-3 text-orange-700">{row.return}</td>
                          <td className="py-2 pr-3 font-medium">{row.activeAssigned}</td>
                          <td className="py-2 pr-3">{row.completed}</td>
                          <td className="py-2 pr-3">{row.delivered}</td>
                          <td className="py-2 pr-3">{formatRs(row.totalCollection)}</td>
                          <td className="py-2 pr-3">
                            {row.delivered > 0
                              ? formatRs(Math.round(row.averageBill))
                              : "—"}
                          </td>
                          <td className="py-2 pr-3">
                            {row.completionRate != null ? `${row.completionRate}%` : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-semibold text-slate-900">
                        <td className="py-2 pr-3">All technicians</td>
                        <td className="py-2 pr-3">{technicianData.totals.received}</td>
                        <td className="py-2 pr-3">{technicianData.totals.pending}</td>
                        <td className="py-2 pr-3">
                          {technicianData.totals.waitingForApproval}
                        </td>
                        <td className="py-2 pr-3">{technicianData.totals.ready}</td>
                        <td className="py-2 pr-3">{technicianData.totals.return}</td>
                        <td className="py-2 pr-3">{technicianData.totals.activeAssigned}</td>
                        <td className="py-2 pr-3">{technicianData.totals.completed}</td>
                        <td className="py-2 pr-3">{technicianData.totals.delivered}</td>
                        <td className="py-2 pr-3">
                          {formatRs(technicianData.totals.totalCollection)}
                        </td>
                        <td className="py-2 pr-3">—</td>
                        <td className="py-2 pr-3">—</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                {technicianData.technicianReports.map((row) => (
                  <Card key={row.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        <Link
                          href={reportJobsHref({
                            technicianId: row.id,
                            active: true,
                          })}
                          className="hover:text-emerald-700"
                        >
                          {row.name}
                        </Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 text-sm">
                      <ReportLinkCard
                        href={reportJobsHref({
                          technicianId: row.id,
                          receivedPeriod: periodFilter,
                        })}
                        className="bg-slate-50"
                        label="Received"
                        value={row.received}
                      />
                      <ReportLinkCard
                        href={reportJobsHref({
                          technicianId: row.id,
                          status: "Pending",
                        })}
                        className="bg-amber-50"
                        label="Pending"
                        value={row.pending}
                      />
                      <ReportLinkCard
                        href={reportJobsHref({
                          technicianId: row.id,
                          status: "Ready",
                        })}
                        className="bg-emerald-50"
                        label="Ready"
                        value={row.ready}
                      />
                      <ReportLinkCard
                        href={reportJobsHref({
                          completedByTechnicianId: row.id,
                          readyPeriod: periodFilter,
                        })}
                        className="bg-blue-50"
                        label="Completed"
                        value={row.completed}
                      />
                      <ReportLinkCard
                        href={reportJobsHref({
                          completedByTechnicianId: row.id,
                          deliveredPeriod: periodFilter,
                        })}
                        className="bg-violet-50"
                        label="Delivered"
                        value={row.delivered}
                      />
                      <ReportLinkCard
                        href={reportJobsHref({
                          completedByTechnicianId: row.id,
                          deliveredPeriod: periodFilter,
                        })}
                        className="bg-green-50"
                        label="Collection"
                        value={formatRs(row.totalCollection)}
                      />
                      <div className="col-span-2 grid grid-cols-2 gap-2">
                        <ReportLinkCard
                          href={reportJobsHref({
                            technicianId: row.id,
                            status: "WaitingForCustomerApproval",
                          })}
                          className="border border-slate-200 bg-white"
                          label="Waiting"
                          value={row.waitingForApproval}
                        />
                        <ReportLinkCard
                          href={reportJobsHref({
                            technicianId: row.id,
                            status: "Return",
                          })}
                          className="border border-slate-200 bg-white"
                          label="Return"
                          value={row.return}
                        />
                      </div>
                      {row.completionRate != null && row.delivered > 0 ? (
                        <p className="col-span-2 text-xs text-slate-600">
                          Delivery rate {row.completionRate}% · Bills{" "}
                          {formatRs(row.lowestBill)} – {formatRs(row.highestBill)}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
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
                    <Link
                      key={row.applianceType}
                      href={reportJobsHref({ applianceType: row.applianceType })}
                      className="flex justify-between gap-2 rounded-md px-2 py-2 transition-colors hover:bg-slate-50"
                    >
                      <span className="text-slate-700">{row.applianceType}</span>
                      <span className="text-right text-slate-900">
                        {row.totalJobs} jobs · {formatRs(row.totalCollection)} · avg{" "}
                        {formatRs(Math.round(row.averageServiceAmount))}
                      </span>
                    </Link>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Brand-wise</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {brandData.brandReports.map((row) => (
                    <Link
                      key={row.brand}
                      href={reportJobsHref({ brand: row.brand })}
                      className="flex justify-between rounded-md px-2 py-2 transition-colors hover:bg-slate-50"
                    >
                      <span className="text-slate-700">{row.brand}</span>
                      <span className="font-semibold text-slate-900">
                        {row.totalJobs} · {formatRs(row.totalCollection)}
                      </span>
                    </Link>
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
