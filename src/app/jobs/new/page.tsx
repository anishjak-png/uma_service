"use client";

import { AppShell } from "@/components/AppShell";
import { CreatableSelect } from "@/components/CreatableSelect";
import { ReceiptActions } from "@/components/ReceiptActions";
import { SHOP_NAME } from "@/lib/constants";
import { formatMobileDisplay } from "@/lib/jobs";
import Link from "next/link";
import { FormEvent, useCallback, useState } from "react";

type CreatedJob = {
  id: string;
  jobNumber: string;
  receivedAt: string;
  applianceType: string;
  brand?: string | null;
  model?: string | null;
  complaint: string;
  customer: { mobile: string; name?: string | null };
  assignedTechnician?: { name: string } | null;
};

export default function NewJobPage() {
  const [mobile, setMobile] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [complaint, setComplaint] = useState("");
  const [assignedTechName, setAssignedTechName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdJob, setCreatedJob] = useState<CreatedJob | null>(null);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mobile,
        customerName: customerName || undefined,
        applianceType,
        brand: brand || undefined,
        model: model || undefined,
        complaint,
      }),
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

  if (createdJob) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="rounded-2xl bg-green-50 p-6 text-center">
            <p className="text-sm font-medium text-green-700">Job Card Created</p>
            <p className="mt-2 break-all text-3xl font-bold text-green-900">
              {createdJob.jobNumber}
            </p>
            {createdJob.assignedTechnician && (
              <p className="mt-2 text-sm text-green-700">
                Assigned to {createdJob.assignedTechnician.name}
              </p>
            )}
          </div>

          <div className="rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-6 text-center">
            <p className="text-sm font-medium text-orange-700">Write on product sticker</p>
            <p className="mt-3 text-4xl font-bold tracking-wide text-orange-900">
              {createdJob.jobNumber}
            </p>
            <p className="mt-4 text-3xl font-bold text-orange-800">
              {formatMobileDisplay(createdJob.customer.mobile)}
            </p>
          </div>

          <ReceiptActions job={createdJob} autoPoll />

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setCreatedJob(null);
                setMobile("");
                setCustomerName("");
                setApplianceType("");
                setBrand("");
                setModel("");
                setComplaint("");
                setAssignedTechName(null);
              }}
              className="w-full rounded-xl bg-orange-600 py-4 text-lg font-semibold text-white hover:bg-orange-700"
            >
              Create Another Job
            </button>
            <Link
              href={`/jobs/${createdJob.id}`}
              className="w-full rounded-xl border-2 border-gray-300 py-4 text-center text-lg font-semibold text-gray-700 hover:bg-gray-50"
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
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">New Job Card</h2>
          <p className="text-sm text-gray-500">{SHOP_NAME}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Customer Mobile *
              </label>
              <input
                type="tel"
                inputMode="numeric"
                required
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  lookupCustomer(e.target.value);
                }}
                placeholder="10-digit mobile number"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm space-y-4">
            <CreatableSelect
              category="appliance"
              label="Appliance Type"
              value={applianceType}
              onChange={setApplianceType}
              onSelect={fetchAssignedTech}
              required
            />

            {assignedTechName && (
              <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">
                Will assign to technician: <strong>{assignedTechName}</strong>
              </p>
            )}

            <CreatableSelect
              category="brand"
              label="Brand"
              value={brand}
              onChange={setBrand}
            />

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>

            <CreatableSelect
              category="complaint"
              label="Complaint / Issue"
              value={complaint}
              onChange={setComplaint}
              required
              placeholder="Select or add complaint"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !applianceType || !complaint}
            className="w-full rounded-xl bg-orange-600 py-4 text-lg font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Job Card"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
