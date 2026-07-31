"use client";

import { AppShell } from "@/components/AppShell";
import { CreatableSelect } from "@/components/CreatableSelect";
import { ReceiptActions } from "@/components/ReceiptActions";
import { MAX_PRODUCT_PHOTOS } from "@/lib/constants";
import { formatMobileDisplay } from "@/lib/jobs";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CreatedJob = {
  id: string;
  jobNumber: string;
  receivedAt: string;
  applianceType: string;
  brand: string;
  model?: string | null;
  complaint: string;
  customer: { mobile: string; name?: string | null };
  assignedTechnician?: { name: string } | null;
};

type LookupOptions = {
  appliance: Array<{ value: string }>;
};

export default function NewJobPage() {
  const { role, loaded: authLoaded } = useAuth();
  const [lookupOptions, setLookupOptions] = useState<Record<string, string[]>>({
    appliance: [],
    brand: [],
    complaint: [],
    accessory: [],
  });
  const [mobile, setMobile] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [complaint, setComplaint] = useState("");
  const [physicalCondition, setPhysicalCondition] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [assignedTechName, setAssignedTechName] = useState<string | null>(null);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [otherAccessory, setOtherAccessory] = useState("");
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdJob, setCreatedJob] = useState<CreatedJob | null>(null);

  useEffect(() => {
    fetch("/api/lookups?category=appliance")
      .then((r) => r.json())
      .then((data: LookupOptions["appliance"]) => {
        setLookupOptions((prev) => ({
          ...prev,
          appliance: data?.map((o) => o.value) ?? [],
        }));
      });
  }, []);

  const loadProductLookups = useCallback(async (appliance: string) => {
    if (!appliance) {
      setLookupOptions((prev) => ({ ...prev, brand: [], complaint: [], accessory: [] }));
      return;
    }

    setLookupsLoading(true);
    try {
      const res = await fetch(
        `/api/appliance-lookups?applianceType=${encodeURIComponent(appliance)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setLookupOptions((prev) => ({ ...prev, brand: [], complaint: [], accessory: [] }));
        return;
      }
      setLookupOptions((prev) => ({
        ...prev,
        brand: data.brands ?? [],
        complaint: data.complaints ?? [],
        accessory: data.accessories ?? [],
      }));
    } finally {
      setLookupsLoading(false);
    }
  }, []);

  function handleLookupOptionsChange(
    category: "appliance" | "brand" | "complaint",
    options: string[]
  ) {
    setLookupOptions((prev) => ({ ...prev, [category]: options }));
  }

  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  const lookupCustomer = useCallback(async (value: string) => {
    const digits = value.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) return;

    const res = await fetch(`/api/customers/lookup?mobile=${digits}`);
    const data = await res.json();
    if (data.found && data.name) {
      setCustomerName(data.name);
    }
  }, []);

  async function fetchAssignedTech(appliance: string) {
    const res = await fetch("/api/appliance-technicians");
    const mappings = await res.json();
    const match = mappings.find(
      (m: { applianceType: string; technician: { name: string } }) =>
        m.applianceType === appliance
    );
    setAssignedTechName(match?.technician?.name ?? null);
  }

  async function handleApplianceSelect(appliance: string) {
    setBrand("");
    setComplaint("");
    setSelectedAccessories([]);
    setOtherAccessory("");
    await Promise.all([fetchAssignedTech(appliance), loadProductLookups(appliance)]);
  }

  function toggleAccessory(name: string) {
    setSelectedAccessories((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).slice(0, MAX_PRODUCT_PHOTOS - photoFiles.length);
    if (newFiles.length === 0) return;

    setPhotoFiles((prev) => [...prev, ...newFiles].slice(0, MAX_PRODUCT_PHOTOS));
    setPhotoPreviews((prev) => [
      ...prev,
      ...newFiles.map((f) => URL.createObjectURL(f)),
    ].slice(0, MAX_PRODUCT_PHOTOS));

    e.target.value = "";
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setCreatedJob(null);
    setMobile("");
    setCustomerName("");
    setApplianceType("");
    setBrand("");
    setModel("");
    setComplaint("");
    setPhysicalCondition("");
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotoFiles([]);
    setPhotoPreviews([]);
    setAssignedTechName(null);
    setSelectedAccessories([]);
    setOtherAccessory("");
    setLookupOptions((prev) => ({ ...prev, brand: [], complaint: [], accessory: [] }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.set("mobile", mobile);
    formData.set("customerName", customerName);
    formData.set("applianceType", applianceType);
    formData.set("brand", brand);
    formData.set("model", model);
    formData.set("complaint", complaint);
    formData.set("physicalCondition", physicalCondition);
    const accessoriesList = [...selectedAccessories];
    const other = otherAccessory.trim();
    if (other) accessoriesList.push(`Other: ${other}`);
    if (accessoriesList.length > 0) {
      formData.set("accessories", JSON.stringify(accessoriesList));
    }
    photoFiles.forEach((file) => formData.append("photos", file));

    const res = await fetch("/api/jobs", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create job");
      setLoading(false);
      return;
    }

    setCreatedJob(data);
    setLoading(false);
  }

  if (!authLoaded) {
    return (
      <AppShell>
        <p className="text-center text-slate-500">Loading...</p>
      </AppShell>
    );
  }

  if (role === "technician") {
    return (
      <AppShell>
        <p className="text-center text-slate-500">Technicians cannot create job cards.</p>
      </AppShell>
    );
  }

  if (createdJob) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm font-medium text-green-700">Job Card Created</p>
              <p className="mt-2 break-all text-3xl font-bold text-green-900">
                {createdJob.jobNumber}
              </p>
              {createdJob.assignedTechnician && (
                <p className="mt-2 text-sm text-green-700">
                  Assigned to {createdJob.assignedTechnician.name}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-2 border-dashed border-emerald-300 bg-emerald-50">
            <CardContent className="p-6 text-center">
              <p className="text-sm font-medium text-emerald-700">Write on product sticker</p>
              <p className="mt-3 text-4xl font-bold tracking-wide text-emerald-900">
                {createdJob.jobNumber}
              </p>
              <p className="mt-4 text-3xl font-bold text-emerald-800">
                {formatMobileDisplay(createdJob.customer.mobile)}
              </p>
            </CardContent>
          </Card>

          <ReceiptActions job={createdJob} autoPoll />

          <div className="flex flex-col gap-2">
            <button
              onClick={resetForm}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Create Another Job
            </button>
            <Link
              href={`/jobs/${createdJob.id}`}
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              View Job Details
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Mobile Number *</label>
              <input
                type="tel"
                inputMode="numeric"
                required
                autoFocus
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  lookupCustomer(e.target.value);
                }}
                placeholder="10-digit mobile number"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Customer Name *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CreatableSelect
              category="appliance"
              label="Product Type"
              value={applianceType}
              onChange={setApplianceType}
              onSelect={handleApplianceSelect}
              options={lookupOptions.appliance}
              onOptionsChange={handleLookupOptionsChange}
              required
            />

            {assignedTechName && (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Will assign to technician: <strong>{assignedTechName}</strong>
              </p>
            )}

            {!applianceType ? (
              <p className="text-xs text-slate-500">
                Select a product type to see available brands and complaints.
              </p>
            ) : lookupsLoading ? (
              <p className="text-xs text-slate-500">Loading brands and complaints…</p>
            ) : null}

            <CreatableSelect
              category="brand"
              label="Brand"
              value={brand}
              onChange={setBrand}
              options={lookupOptions.brand}
              onOptionsChange={handleLookupOptionsChange}
              applianceType={applianceType}
              disabled={!applianceType || lookupsLoading}
              required
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Optional model number"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>

            <CreatableSelect
              category="complaint"
              label="Complaint"
              value={complaint}
              onChange={setComplaint}
              options={lookupOptions.complaint}
              onOptionsChange={handleLookupOptionsChange}
              applianceType={applianceType}
              disabled={!applianceType || lookupsLoading}
              required
              placeholder="Select or add complaint"
            />

            {applianceType && lookupOptions.accessory.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Accessories received</p>
                <div className="space-y-2 rounded-md border border-slate-200 p-3">
                  {lookupOptions.accessory.map((item) => (
                    <label
                      key={item}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAccessories.includes(item)}
                        onChange={() => toggleAccessory(item)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {item}
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  value={otherAccessory}
                  onChange={(e) => setOtherAccessory(e.target.value)}
                  placeholder="Other accessory (optional)"
                  className="flex h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Physical Condition</label>
              <textarea
                value={physicalCondition}
                onChange={(e) => setPhysicalCondition(e.target.value)}
                placeholder="Optional - scratches, dents, missing parts, etc."
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Product Photos (max {MAX_PRODUCT_PHOTOS})
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={photoFiles.length >= MAX_PRODUCT_PHOTOS}
                onChange={handlePhotoUpload}
                className="block w-full text-sm text-slate-600"
              />
              {photoPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photoPreviews.map((preview, i) => (
                    <div key={preview} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt={`Product ${i + 1}`}
                        className="h-20 w-20 rounded-md border border-slate-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-xs text-white"
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            !customerName.trim() ||
            !mobile ||
            !applianceType ||
            !brand ||
            !complaint
          }
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Job Card"}
        </button>
      </form>
    </AppShell>
  );
}
