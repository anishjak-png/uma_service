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
import { WhatsAppInboxTab } from "./WhatsAppInboxTab";
import { StaffTab } from "./StaffTab";
import { DevicesTab } from "./DevicesTab";
import { OutsourceTab } from "./OutsourceTab";
import { reportJobsHref } from "@/lib/report-links";
import { periodLabel, type ReportPeriod } from "@/lib/reports";

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
    tabFromUrl === "outsource" ||
    tabFromUrl === "technicians" ||
    tabFromUrl === "appliances" ||
    tabFromUrl === "customers" ||
    tabFromUrl === "inbox" ||
    tabFromUrl === "whatsapp"
      ? tabFromUrl
      : "devices";

  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);

  useEffect(() => {
    if (!authLoaded || role !== "admin") return;

    async function loadInboxUnread() {
      const res = await fetch("/api/admin/whatsapp/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setInboxUnreadCount(data.totalUnread ?? 0);
    }

    void loadInboxUnread();
    const interval = setInterval(() => void loadInboxUnread(), 30000);
    return () => clearInterval(interval);
  }, [authLoaded, role]);

  useEffect(() => {
    const requested = searchParams.get("tab");
    if (
      requested === "devices" ||
      requested === "staff" ||
      requested === "outsource" ||
      requested === "technicians" ||
      requested === "appliances" ||
      requested === "customers" ||
      requested === "inbox" ||
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
          inboxUnreadCount={inboxUnreadCount}
        />
      )}
      {tab === "devices" && <DevicesTab />}
      {tab === "staff" && <StaffTab />}
      {tab === "outsource" && <OutsourceTab />}
      {tab === "technicians" && <TechniciansTab />}
      {tab === "appliances" && <AppliancesTab />}
      {tab === "customers" && <CustomersTab />}
      {tab === "inbox" && (
        <WhatsAppInboxTab onUnreadChange={setInboxUnreadCount} />
      )}
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
  const [accessories, setAccessories] = useState<string[]>([]);
  const [lookupError, setLookupError] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newComplaint, setNewComplaint] = useState("");
  const [newAccessory, setNewAccessory] = useState("");

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
      setAccessories([]);
      return;
    }

    setLookupError("");
    try {
      const data = await fetchJson<{
        brands: string[];
        complaints: string[];
        accessories: string[];
      }>(
        `/api/appliance-lookups?applianceType=${encodeURIComponent(applianceType)}`
      );
      setBrands(data.brands ?? []);
      setComplaints(data.complaints ?? []);
      setAccessories(data.accessories ?? []);
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

  async function addLookup(
    category: "brand" | "complaint" | "accessory",
    value: string
  ) {
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
      else if (category === "complaint") setNewComplaint("");
      else setNewAccessory("");
      loadProductLookups(selectedAppliance);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Add failed");
    }
  }

  async function removeLookup(
    category: "brand" | "complaint" | "accessory",
    value: string
  ) {
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
          <CardTitle>Brands, Complaints & Accessories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-500">
            Select a product type on the left, then assign brands, complaints, and
            accessories shown when creating jobs for that product.
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
                <p className="text-sm font-medium text-slate-700">Accessories</p>
                <ul className="space-y-1">
                  {accessories.map((accessory) => (
                    <li
                      key={accessory}
                      className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm"
                    >
                      <span>{accessory}</span>
                      <button
                        onClick={() => removeLookup("accessory", accessory)}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                  {accessories.length === 0 && (
                    <p className="text-sm text-slate-500">No accessories assigned yet.</p>
                  )}
                </ul>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAccessory}
                    onChange={(e) => setNewAccessory(e.target.value)}
                    placeholder="Add accessory (e.g. Jars)"
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLookup("accessory", newAccessory);
                      }
                    }}
                  />
                  <button
                    onClick={() => addLookup("accessory", newAccessory)}
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

const TECH_BAR_SERIES = [
  { key: "received" as const, label: "Rec", color: "bg-slate-500" },
  { key: "pending" as const, label: "Pend", color: "bg-amber-500" },
  { key: "ready" as const, label: "Ready", color: "bg-emerald-500" },
  { key: "delivered" as const, label: "Del", color: "bg-violet-500" },
];

/** Compact horizontal bars: Received, Pending, Ready, Delivered for one tech. */
function TechStaffBarChart({
  received,
  pending,
  ready,
  delivered,
  maxValue,
}: {
  received: number;
  pending: number;
  ready: number;
  delivered: number;
  maxValue: number;
}) {
  const scale = Math.max(1, maxValue);
  const values = { received, pending, ready, delivered };

  return (
    <div className="min-w-0 flex-1 space-y-0.5">
      {TECH_BAR_SERIES.map((s) => {
        const v = values[s.key];
        const pct = Math.round((v / scale) * 100);
        return (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="w-7 shrink-0 text-[9px] font-medium text-slate-500">
              {s.label}
            </span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${s.color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-4 shrink-0 text-right text-[10px] tabular-nums text-slate-700">
              {v}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReportsTab() {
  const [period, setPeriod] = useState<ReportPeriod>("today");
  const [reportSection, setReportSection] = useState<
    "summary" | "technicians" | "brands-appliances"
  >("summary");
  const [summary, setSummary] = useState<{
    summary: {
      jobsCreated: number;
      delivered: number;
      undelivered: number;
      undeliveredReady: number;
      undeliveredReturn: number;
      pendingOpen: number;
      pendingOpenPending: number;
      pendingOpenWaiting: number;
      pendingOpenOutsourced: number;
      pendingOpenWarranty: number;
      totalCollection: number;
      jobsReturned: number;
      jobsDeliveredReady: number;
      jobsDeliveredReturn: number;
      pendingLive: number;
      returnLive: number;
      outsourcedLive: number;
      warrantyLive: number;
      readyLive: number;
      readyLiveAmount: number;
    };
    pendingAging: { over3Days: number; over7Days: number; over15Days: number };
    undeliveredAging: { over3Days: number; over7Days: number; over15Days: number };
    readyNotDelivered?: { count: number; totalAmount: number };
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
      activePipeline: number;
      completed: number;
      delivered: number;
      totalCollection: number;
      averageBill: number;
      lowestBill: number;
      highestBill: number;
    }>;
    totals: {
      received: number;
      pending: number;
      waitingForApproval: number;
      ready: number;
      return: number;
      activePipeline: number;
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {(
          [
            { id: "today", label: "Today" },
            { id: "week", label: "This week" },
            { id: "month", label: "This month" },
            { id: "year", label: "This year" },
          ] as const
        ).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`min-w-0 flex-1 rounded-md px-2 py-2 text-xs font-medium sm:text-sm ${
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
            { id: "brands-appliances", label: "Brands" },
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
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {periodLabel(period)} · jobs created
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard
                label="Jobs created"
                value={summary.summary.jobsCreated}
                href={reportJobsHref({ receivedPeriod: period })}
              />
              <StatCard
                label="Delivered"
                value={summary.summary.delivered}
                href={reportJobsHref({
                  receivedPeriod: period,
                  pipeline: "delivered",
                })}
              />
              <StatCard
                label="Undelivered"
                value={summary.summary.undelivered}
                subtext={`Ready ${summary.summary.undeliveredReady} · Return ${summary.summary.undeliveredReturn}`}
                href={reportJobsHref({
                  receivedPeriod: period,
                  pipeline: "undelivered",
                })}
                valueClassName="text-emerald-700"
              />
              <StatCard
                label="Pending"
                value={summary.summary.pendingOpen}
                subtext={`P ${summary.summary.pendingOpenPending} · O ${summary.summary.pendingOpenOutsourced} · W ${summary.summary.pendingOpenWarranty}`}
                href={reportJobsHref({
                  receivedPeriod: period,
                  pipeline: "pending",
                })}
                valueClassName="text-blue-700"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Created = Delivered + Undelivered + Pending (same period jobs by
              current status).
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatCard
                label="Collection"
                value={formatRs(summary.summary.totalCollection)}
                subtext={`${summary.summary.jobsDeliveredReady} repair · ${summary.summary.jobsDeliveredReturn} return`}
                href={reportJobsHref({
                  receivedPeriod: period,
                  pipeline: "delivered",
                })}
                valueClassName="text-emerald-800"
              />
              <StatCard
                label="Returned"
                value={summary.summary.jobsReturned}
                subtext="Return → Delivered only"
                href={reportJobsHref({
                  receivedPeriod: period,
                  pipeline: "returned",
                })}
                valueClassName="text-orange-700"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Live activity
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard
                label="Pending"
                value={summary.summary.pendingLive}
                href={reportJobsHref({ status: "Pending" })}
                valueClassName="text-blue-700"
              />
              <StatCard
                label="Ready"
                value={summary.summary.readyLive}
                subtext={formatRs(summary.summary.readyLiveAmount)}
                href={reportJobsHref({ status: "Ready" })}
                valueClassName="text-emerald-700"
              />
              <StatCard
                label="Return"
                value={summary.summary.returnLive}
                href={reportJobsHref({ status: "Return" })}
                valueClassName="text-orange-700"
              />
              <StatCard
                label="Outsourced"
                value={summary.summary.outsourcedLive}
                href={reportJobsHref({ status: "Outsourced" })}
                valueClassName="text-purple-700"
              />
              <StatCard
                label="Warranty"
                value={summary.summary.warrantyLive}
                href="/jobs/pending?warranty=true"
                valueClassName="text-sky-700"
              />
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pending aging</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-sm">
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Undelivered aging</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-sm">
              <ReportLinkCard
                href={reportJobsHref({ pipeline: "undelivered", minAgeDays: 3 })}
                className="bg-amber-50"
                label="> 3 days"
                value={summary.undeliveredAging.over3Days}
              />
              <ReportLinkCard
                href={reportJobsHref({ pipeline: "undelivered", minAgeDays: 7 })}
                className="bg-orange-50"
                label="> 7 days"
                value={summary.undeliveredAging.over7Days}
              />
              <ReportLinkCard
                href={reportJobsHref({ pipeline: "undelivered", minAgeDays: 15 })}
                className="bg-red-50"
                label="> 15 days"
                value={summary.undeliveredAging.over15Days}
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
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Staff · {periodLabel(period)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(() => {
                    const maxValue = Math.max(
                      1,
                      ...technicianData.technicianReports.flatMap((r) => [
                        r.received,
                        r.pending,
                        r.ready,
                        r.delivered,
                      ])
                    );
                    return technicianData.technicianReports.map((row) => (
                      <Link
                        key={row.id}
                        href={reportJobsHref({
                          technicianId: row.id,
                          active: true,
                        })}
                        className="flex items-start gap-2 rounded-md px-1 py-1.5 hover:bg-slate-50"
                      >
                        <span className="w-20 shrink-0 truncate pt-0.5 text-sm font-medium text-slate-900 sm:w-24">
                          {row.name}
                        </span>
                        <TechStaffBarChart
                          received={row.received}
                          pending={row.pending}
                          ready={row.ready}
                          delivered={row.delivered}
                          maxValue={maxValue}
                        />
                      </Link>
                    ));
                  })()}
                  <p className="pt-1 text-xs text-slate-500">
                    Rec &amp; Del = {periodLabel(period).toLowerCase()}. Pend &amp;
                    Ready = live. Bars share the same scale across staff.
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-3">
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
                    <CardContent className="space-y-3">
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Live now
                        </p>
                        <div className="grid grid-cols-4 gap-1.5 text-sm">
                          <ReportLinkCard
                            href={reportJobsHref({
                              technicianId: row.id,
                              status: "Pending",
                            })}
                            className="bg-amber-50 px-2 py-2"
                            label="Pending"
                            value={row.pending}
                          />
                          <ReportLinkCard
                            href={reportJobsHref({
                              technicianId: row.id,
                              status: "Ready",
                            })}
                            className="bg-emerald-50 px-2 py-2"
                            label="Ready"
                            value={row.ready}
                          />
                          <ReportLinkCard
                            href={reportJobsHref({
                              technicianId: row.id,
                              status: "WaitingForCustomerApproval",
                            })}
                            className="bg-white px-2 py-2 ring-1 ring-slate-200"
                            label="Waiting"
                            value={row.waitingForApproval}
                          />
                          <ReportLinkCard
                            href={reportJobsHref({
                              technicianId: row.id,
                              status: "Return",
                            })}
                            className="bg-orange-50 px-2 py-2"
                            label="Return"
                            value={row.return}
                          />
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {periodLabel(period)}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 text-sm sm:grid-cols-4">
                          <ReportLinkCard
                            href={reportJobsHref({
                              technicianId: row.id,
                              receivedPeriod: period,
                            })}
                            className="bg-slate-50 px-2 py-2"
                            label="Received"
                            value={row.received}
                          />
                          <ReportLinkCard
                            href={reportJobsHref({
                              completedByTechnicianId: row.id,
                              readyPeriod: period,
                            })}
                            className="bg-blue-50 px-2 py-2"
                            label="Completed"
                            value={row.completed}
                          />
                          <ReportLinkCard
                            href={reportJobsHref({
                              completedByTechnicianId: row.id,
                              deliveredPeriod: period,
                            })}
                            className="bg-violet-50 px-2 py-2"
                            label="Delivered"
                            value={row.delivered}
                          />
                          <ReportLinkCard
                            href={reportJobsHref({
                              completedByTechnicianId: row.id,
                              deliveredPeriod: period,
                            })}
                            className="bg-green-50 px-2 py-2"
                            label="Collection"
                            value={formatRs(row.totalCollection)}
                          />
                        </div>
                        {row.delivered > 0 ? (
                          <p className="mt-1.5 text-xs text-slate-500">
                            Avg {formatRs(Math.round(row.averageBill))} · Bills{" "}
                            {formatRs(row.lowestBill)} – {formatRs(row.highestBill)}
                          </p>
                        ) : null}
                      </div>
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
                  <CardTitle className="text-base">
                    Appliance-wise · {periodLabel(period)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {brandData.applianceReports.length === 0 ? (
                    <p className="text-slate-500">No jobs in this period</p>
                  ) : (
                    brandData.applianceReports.map((row) => (
                      <Link
                        key={row.applianceType}
                        href={reportJobsHref({
                          applianceType: row.applianceType,
                          receivedPeriod: period,
                        })}
                        className="flex justify-between gap-2 rounded-md px-2 py-2 transition-colors hover:bg-slate-50"
                      >
                        <span className="text-slate-700">{row.applianceType}</span>
                        <span className="text-right text-slate-900">
                          {row.totalJobs} jobs · {formatRs(row.totalCollection)} · avg{" "}
                          {formatRs(Math.round(row.averageServiceAmount))}
                        </span>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Brand-wise · {periodLabel(period)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {brandData.brandReports.length === 0 ? (
                    <p className="text-slate-500">No jobs in this period</p>
                  ) : (
                    brandData.brandReports.map((row) => (
                      <Link
                        key={row.brand}
                        href={reportJobsHref({
                          brand: row.brand,
                          receivedPeriod: period,
                        })}
                        className="flex justify-between rounded-md px-2 py-2 transition-colors hover:bg-slate-50"
                      >
                        <span className="text-slate-700">{row.brand}</span>
                        <span className="font-semibold text-slate-900">
                          {row.totalJobs} · {formatRs(row.totalCollection)}
                        </span>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
