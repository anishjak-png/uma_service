"use client";

import { AppShell } from "@/components/AppShell";
import { CallCustomerButton } from "@/components/CallCustomerButton";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { ReceiptActions } from "@/components/ReceiptActions";
import { WhatsAppActions } from "@/components/WhatsAppActions";
import { JobNotificationSettings } from "@/components/JobNotificationSettings";
import {
  getSelectableStatuses,
  isDeliveredTerminal,
  STATUS_LABELS,
  type JobStatusValue,
  type StaffRole,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/currency";
import {
  daysSince,
  formatAccessoryLabel,
  formatMobileDisplay,
  formatStatusChangedBy,
  formatDate,
  formatDateTime,
  parseProductPhotos,
  parseAccessories,
  normalizeMobile,
  toDateInputValue,
  type AccessoryItem,
} from "@/lib/jobs";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";

type JobDetail = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand: string;
  model?: string | null;
  complaint: string;
  physicalCondition?: string | null;
  productPhotos?: string | null;
  remarks?: string | null;
  serviceAmount?: number | null;
  receivedAt: string;
  readyAt?: string | null;
  deliveredAt?: string | null;
  createdBy?: string | null;
  accessories?: string | null;
  outsourcedAt?: string | null;
  whatsappNotificationsOverride?: boolean | null;
  isWarranty?: boolean;
  warrantyPurchaseDate?: string | null;
  warrantyTakenAt?: string | null;
  assignedTechnician?: { id: string; name: string } | null;
  completedByTechnician?: { id: string; name: string } | null;
  outsourcedTo?: { id: string; name: string } | null;
  completedByOutsource?: { id: string; name: string } | null;
  customer: {
    id: string;
    mobile: string;
    name?: string | null;
    allowWhatsappNotifications: boolean;
  };
  statusHistory: Array<{
    id: string;
    status: string;
    note?: string | null;
    changedBy?: string | null;
    changedAt: string;
  }>;
};

type JobPatchResponse = Partial<JobDetail> & {
  statusHistoryEntry?: JobDetail["statusHistory"][number];
};

function mergeJobPatch(prev: JobDetail, patch: JobPatchResponse): JobDetail {
  const { statusHistoryEntry, ...fields } = patch;
  return {
    ...prev,
    ...fields,
    assignedTechnician:
      fields.assignedTechnician !== undefined
        ? fields.assignedTechnician
        : prev.assignedTechnician,
    completedByTechnician:
      fields.completedByTechnician !== undefined
        ? fields.completedByTechnician
        : prev.completedByTechnician,
    outsourcedTo:
      fields.outsourcedTo !== undefined ? fields.outsourcedTo : prev.outsourcedTo,
    completedByOutsource:
      fields.completedByOutsource !== undefined
        ? fields.completedByOutsource
        : prev.completedByOutsource,
    statusHistory: statusHistoryEntry
      ? [statusHistoryEntry, ...prev.statusHistory]
      : prev.statusHistory,
  };
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <div className="mt-0.5 text-base text-slate-900">{children}</div>
    </div>
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { role, loaded: authLoaded } = useAuth();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [readyAmount, setReadyAmount] = useState("");
  const [readyCompletedById, setReadyCompletedById] = useState("");
  const [showReadyForm, setShowReadyForm] = useState(false);
  const [showAmountEdit, setShowAmountEdit] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [technicians, setTechnicians] = useState<Array<{ id: string; name: string }>>([]);
  const [editCompletedById, setEditCompletedById] = useState("");
  const [showCompletedByEdit, setShowCompletedByEdit] = useState(false);
  const [outsourcePartners, setOutsourcePartners] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showOutsourceForm, setShowOutsourceForm] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [showConvertWarrantyForm, setShowConvertWarrantyForm] = useState(false);
  const [convertPurchaseDate, setConvertPurchaseDate] = useState("");
  const [purchaseDateEdit, setPurchaseDateEdit] = useState("");
  const [editingPurchaseDate, setEditingPurchaseDate] = useState(false);
  const [accessoryOptions, setAccessoryOptions] = useState<string[]>([]);
  const [accessoryQty, setAccessoryQty] = useState<Record<string, number>>({});
  const [otherAccessory, setOtherAccessory] = useState("");
  const [otherAccessoryQty, setOtherAccessoryQty] = useState(1);
  const [editingAccessories, setEditingAccessories] = useState(false);

  function accessoriesToQtyMap(items: AccessoryItem[]) {
    const map: Record<string, number> = {};
    for (const item of items) {
      if (item.name.startsWith("Other:")) continue;
      map[item.name] = item.qty;
    }
    return map;
  }

  function otherFromAccessories(items: AccessoryItem[]) {
    const other = items.find((item) => item.name.startsWith("Other:"));
    if (!other) return { text: "", qty: 1 };
    return {
      text: other.name.replace(/^Other:\s*/, ""),
      qty: other.qty,
    };
  }

  const fetchJob = useCallback(async () => {
    const jobRes = await fetch(`/api/jobs/${id}`);

    if (!jobRes.ok) {
      router.push("/jobs/pending");
      return;
    }

    const data = await jobRes.json();
    setJob(data);
    setRemarks(data.remarks ?? "");
    setReadyAmount(data.serviceAmount != null ? String(data.serviceAmount) : "");
    setEditAmount(data.serviceAmount != null ? String(data.serviceAmount) : "");
    setEditCompletedById(data.completedByTechnician?.id ?? "");
    setPurchaseDateEdit(toDateInputValue(data.warrantyPurchaseDate));
    const accessories = parseAccessories(data.accessories);
    setAccessoryQty(accessoriesToQtyMap(accessories));
    const other = otherFromAccessories(accessories);
    setOtherAccessory(other.text);
    setOtherAccessoryQty(other.qty);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    if (role === "reception" || role === "admin" || role === "technician") {
      fetch("/api/outsource-partners")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setOutsourcePartners(data);
        });
    }
  }, [role]);

  useEffect(() => {
    if (!job?.applianceType) return;
    fetch(
      `/api/appliance-lookups?applianceType=${encodeURIComponent(job.applianceType)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.accessories) setAccessoryOptions(data.accessories);
      });
  }, [job?.applianceType]);

  useEffect(() => {
    if (role === "reception" || role === "admin") {
      fetch("/api/technicians")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setTechnicians(data);
        });
    }
  }, [role]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  async function updateJob(updates: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = (await res.json()) as JobPatchResponse;
      setJob((prev) => (prev ? mergeJobPatch(prev, data) : prev));
      if (data.remarks !== undefined) setRemarks(data.remarks ?? "");
      setShowReadyForm(false);
      setShowAmountEdit(false);
      setShowOutsourceForm(false);
      setShowConvertWarrantyForm(false);
      if (data.warrantyPurchaseDate !== undefined) {
        setPurchaseDateEdit(toDateInputValue(data.warrantyPurchaseDate));
        setEditingPurchaseDate(false);
      }
      if (data.accessories !== undefined) {
        const accessories = parseAccessories(data.accessories);
        setAccessoryQty(accessoriesToQtyMap(accessories));
        const other = otherFromAccessories(accessories);
        setOtherAccessory(other.text);
        setOtherAccessoryQty(other.qty);
        setEditingAccessories(false);
      }
    } else {
      const data = await res.json();
      alert(data.error ?? "Update failed");
    }
    setSaving(false);
  }

  async function handleStatusChange(status: string) {
    if (status === "Outsourced") {
      setSelectedPartnerId("");
      setShowOutsourceForm(true);
      return;
    }
    if (status === "WarrantyPending" && job && !job.isWarranty) {
      setConvertPurchaseDate("");
      setShowConvertWarrantyForm(true);
      return;
    }
    if (status === "Ready") {
      if (job?.readyAt && role !== "admin") {
        await updateJob({ status: "Ready" });
        return;
      }
      setReadyCompletedById(job?.assignedTechnician?.id ?? "");
      setShowReadyForm(true);
      return;
    }
    if (status === "Return") {
      await updateJob({ status, serviceAmount: 0 });
      return;
    }
    await updateJob({ status });
  }

  async function confirmOutsource() {
    if (!selectedPartnerId) {
      alert("Select an outsource partner");
      return;
    }
    await updateJob({ status: "Outsourced", outsourcedToId: selectedPartnerId });
  }

  async function confirmConvertToWarranty() {
    const updates: Record<string, unknown> = {
      status: "WarrantyPending",
      convertToWarranty: true,
    };
    if (convertPurchaseDate) {
      updates.warrantyPurchaseDate = convertPurchaseDate;
    }
    await updateJob(updates);
    setShowConvertWarrantyForm(false);
  }

  async function savePurchaseDate() {
    await updateJob({
      warrantyPurchaseDate: purchaseDateEdit || null,
    });
    setEditingPurchaseDate(false);
  }

  function toggleAccessory(name: string, checked: boolean) {
    setAccessoryQty((prev) => {
      if (!checked) {
        const next = { ...prev };
        delete next[name];
        return next;
      }
      return { ...prev, [name]: prev[name] ?? 1 };
    });
  }

  function setQty(name: string, qty: number) {
    const nextQty = Number.isFinite(qty) ? Math.max(1, Math.min(999, Math.floor(qty))) : 1;
    setAccessoryQty((prev) => ({ ...prev, [name]: nextQty }));
  }

  async function saveAccessories() {
    const list: AccessoryItem[] = Object.entries(accessoryQty).map(
      ([name, qty]) => ({ name, qty })
    );
    const other = otherAccessory.trim();
    if (other) {
      list.push({
        name: `Other: ${other}`,
        qty: Math.max(1, Math.min(999, Math.floor(otherAccessoryQty) || 1)),
      });
    }
    await updateJob({ accessories: list });
  }

  async function confirmReady() {
    const amount = Number(readyAmount);
    if (Number.isNaN(amount) || amount < 0) {
      alert("Enter a valid service amount");
      return;
    }
    const updates: Record<string, unknown> = {
      status: "Ready",
      serviceAmount: amount,
    };
    const fromWarranty =
      job?.isWarranty ||
      job?.status === "WarrantyPending" ||
      job?.status === "WarrantyWithCompany";
    if (
      (role === "reception" || role === "admin") &&
      !job?.completedByTechnician &&
      job?.status !== "Outsourced" &&
      !fromWarranty
    ) {
      if (!readyCompletedById) {
        alert("Select the technician who completed the repair");
        return;
      }
      updates.completedByTechnicianId = readyCompletedById;
    }
    await updateJob(updates);
  }

  async function handleSaveRemarks() {
    await updateJob({ remarks });
  }

  async function handleSaveAmount() {
    const amount = Number(editAmount);
    if (Number.isNaN(amount) || amount < 0) {
      alert("Enter a valid service amount");
      return;
    }
    await updateJob({ serviceAmount: amount });
  }

  async function handleSaveCompletedBy() {
    await updateJob({
      completedByTechnicianId: editCompletedById || null,
    });
    setShowCompletedByEdit(false);
  }

  if (loading || !job || !authLoaded) {
    return (
      <AppShell>
        <p className="text-center text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  const staffRole = (role ?? "technician") as StaffRole;
  const selectableStatuses = getSelectableStatuses(
    job.status as JobStatusValue,
    staffRole,
    { isWarranty: Boolean(job.isWarranty) }
  );
  const backHref = role === "technician" ? "/jobs/pending" : "/jobs/search";
  const photos = parseProductPhotos(job.productPhotos);
  const isStaff = role === "reception" || role === "admin";
  const isAdmin = role === "admin";
  const showFinancials = isStaff || isAdmin;
  const isLocked = isDeliveredTerminal(job.status) && !isAdmin;
  const canAdminEditAmount = isAdmin && job.readyAt != null && !isLocked;

  const callDigits = normalizeMobile(job.customer.mobile);

  return (
    <AppShell>
      <div className="space-y-5">
        <Link href={backHref} className="text-sm font-medium text-emerald-600 hover:underline">
          ← Back
        </Link>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{job.jobNumber}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Received {formatDateTime(job.receivedAt)}
            <span className="ml-1">
              ({daysSince(new Date(job.receivedAt))} days ago)
            </span>
          </p>
          {job.createdBy && (
            <p className="mt-1 text-sm text-slate-500">
              Created by {formatStatusChangedBy(job.createdBy)}
            </p>
          )}
        </div>

        {showReadyForm && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-emerald-900">Mark as Ready</h3>
            <p className="text-sm text-emerald-800">Service amount is required.</p>
            <input
              type="number"
              min="0"
              step="1"
              value={readyAmount}
              onChange={(e) => setReadyAmount(e.target.value)}
              placeholder="Amount in Rs."
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              autoFocus
            />
            {isStaff &&
              !job.completedByTechnician &&
              job.status !== "Outsourced" &&
              !job.isWarranty &&
              job.status !== "WarrantyPending" &&
              job.status !== "WarrantyWithCompany" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-emerald-900">
                  Completed by (required)
                </label>
                <select
                  value={readyCompletedById}
                  onChange={(e) => setReadyCompletedById(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <option value="">Select technician</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={confirmReady}
                disabled={saving}
                className="flex-1 rounded-md bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirm Ready
              </button>
              <button
                onClick={() => setShowReadyForm(false)}
                className="flex-1 rounded-md border border-slate-300 bg-white py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showOutsourceForm && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-purple-900">Send to Outsource</h3>
            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <option value="">Select partner</option>
              {outsourcePartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={confirmOutsource}
                disabled={saving}
                className="flex-1 rounded-md bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                Send
              </button>
              <button
                onClick={() => setShowOutsourceForm(false)}
                className="flex-1 rounded-md border border-slate-300 bg-white py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showConvertWarrantyForm && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-sky-900">Convert to Warranty</h3>
            <p className="text-sm text-sky-800">
              Moves this job to the warranty queue. Purchase date is optional.
            </p>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-sky-900">
                Purchase date{" "}
                <span className="font-normal text-sky-700/70">(optional)</span>
              </label>
              <input
                type="date"
                value={convertPurchaseDate}
                onChange={(e) => setConvertPurchaseDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmConvertToWarranty}
                disabled={saving}
                className="flex-1 rounded-md bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                Convert
              </button>
              <button
                onClick={() => setShowConvertWarrantyForm(false)}
                className="flex-1 rounded-md border border-slate-300 bg-white py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <DetailSection title="Actions">
          {!showReadyForm &&
            !showOutsourceForm &&
            !showConvertWarrantyForm &&
            selectableStatuses.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">Change Status</p>
              <div className="grid grid-cols-2 gap-2">
                {selectableStatuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={saving}
                    className={`rounded-md py-3 text-sm font-medium text-white disabled:opacity-50 ${
                      !job.isWarranty && status === "WarrantyPending"
                        ? "bg-sky-600 hover:bg-sky-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {!job.isWarranty && status === "WarrantyPending"
                      ? "Convert to Warranty"
                      : STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {callDigits.length === 10 && (
            <a
              href={`tel:${callDigits}`}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Call Customer
            </a>
          )}

          <ReceiptActions job={job} variant="jobDetail" />

          {isStaff && <WhatsAppActions jobId={job.id} jobStatus={job.status} />}

          {job.status !== "Delivered" && isStaff && (
            <Link
              href={`/jobs/delivery?q=${encodeURIComponent(job.jobNumber)}`}
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Go to Delivery
            </Link>
          )}
        </DetailSection>

        <DetailSection title="Customer Details">
          <DetailRow label="Customer Name">
            {job.customer.name ?? "—"}
          </DetailRow>
          <DetailRow label="Mobile Number">
            <div className="flex items-center gap-2">
              <span>{formatMobileDisplay(job.customer.mobile)}</span>
              <CallCustomerButton mobile={job.customer.mobile} />
            </div>
          </DetailRow>
          <DetailRow label="Customer ID">
            <span className="break-all font-mono text-sm">{job.customer.id}</span>
          </DetailRow>
        </DetailSection>

        <DetailSection title="Product Details">
          <DetailRow label="Product Type">{job.applianceType}</DetailRow>
          <DetailRow label="Brand">{job.brand}</DetailRow>
          <DetailRow label="Model">{job.model ?? "—"}</DetailRow>
        </DetailSection>

        {(parseAccessories(job.accessories).length > 0 || (!isLocked && isStaff)) && (
          <DetailSection title="Accessories Received">
            {!editingAccessories ? (
              <div className="space-y-2">
                {parseAccessories(job.accessories).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {parseAccessories(job.accessories).map((item) => (
                      <span
                        key={item.name}
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                      >
                        {formatAccessoryLabel(item)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-base text-slate-500">None recorded</p>
                )}
                {!isLocked && isStaff && (
                  <button
                    type="button"
                    onClick={() => {
                      const accessories = parseAccessories(job.accessories);
                      setAccessoryQty(accessoriesToQtyMap(accessories));
                      const other = otherFromAccessories(accessories);
                      setOtherAccessory(other.text);
                      setOtherAccessoryQty(other.qty);
                      setEditingAccessories(true);
                    }}
                    className="text-sm font-medium text-emerald-700 hover:underline"
                  >
                    Edit accessories
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {accessoryOptions.length > 0 ? (
                  <div className="space-y-2">
                    {accessoryOptions.map((item) => {
                      const checked = accessoryQty[item] != null;
                      return (
                        <div
                          key={item}
                          className="flex items-center gap-2 text-sm text-slate-700"
                        >
                          <label className="flex min-w-0 flex-1 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                toggleAccessory(item, e.target.checked)
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="truncate">{item}</span>
                          </label>
                          {checked && (
                            <input
                              type="number"
                              min={1}
                              max={999}
                              value={accessoryQty[item]}
                              onChange={(e) =>
                                setQty(item, Number(e.target.value))
                              }
                              className="h-8 w-16 shrink-0 rounded-md border border-slate-300 px-2 text-center text-sm"
                              aria-label={`${item} quantity`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    No accessories configured for this product type.
                  </p>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Other</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={otherAccessory}
                      onChange={(e) => setOtherAccessory(e.target.value)}
                      placeholder="Optional — other item received"
                      className="flex h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                    {otherAccessory.trim() && (
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={otherAccessoryQty}
                        onChange={(e) =>
                          setOtherAccessoryQty(
                            Math.max(
                              1,
                              Math.min(999, Math.floor(Number(e.target.value)) || 1)
                            )
                          )
                        }
                        className="h-10 w-16 shrink-0 rounded-md border border-slate-300 px-2 text-center text-sm"
                        aria-label="Other accessory quantity"
                      />
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveAccessories}
                    disabled={saving}
                    className="flex-1 rounded-md bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingAccessories(false)}
                    className="flex-1 rounded-md border border-slate-300 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </DetailSection>
        )}

        <DetailSection title="Complaint">
          <p className="text-base leading-relaxed text-slate-800">{job.complaint}</p>
        </DetailSection>

        {job.physicalCondition && (
          <DetailSection title="Physical Condition">
            <p className="text-base leading-relaxed text-slate-800">
              {job.physicalCondition}
            </p>
          </DetailSection>
        )}

        <DetailSection title="Current Status">
          <JobStatusBadge status={job.status} />
          {job.readyAt && (
            <DetailRow label="Completed">
              {formatDateTime(job.readyAt)}
            </DetailRow>
          )}
          {job.deliveredAt && (
            <DetailRow label="Delivered">
              {formatDateTime(job.deliveredAt)}
            </DetailRow>
          )}
        </DetailSection>

        {job.isWarranty ? (
          <DetailSection title="Warranty Brand">
            <p className="text-base font-medium text-sky-800">{job.brand}</p>
            {job.status === "WarrantyWithCompany" && (
              <p className="mt-1 text-sm font-bold text-slate-900">
                With company
                {job.warrantyTakenAt
                  ? ` · ${formatDateTime(job.warrantyTakenAt)}`
                  : ""}
              </p>
            )}
            {job.status === "WarrantyPending" && (
              <p className="mt-1 text-sm font-bold text-slate-900">At store</p>
            )}
            {isStaff && !isLocked ? (
              editingPurchaseDate ? (
                <div className="space-y-2 pt-1">
                  <label className="block text-sm font-medium text-slate-600">
                    Purchase date{" "}
                    <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={purchaseDateEdit}
                    onChange={(e) => setPurchaseDateEdit(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={savePurchaseDate}
                      disabled={saving}
                      className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPurchaseDateEdit(
                          toDateInputValue(job.warrantyPurchaseDate)
                        );
                        setEditingPurchaseDate(false);
                      }}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-1">
                  <p className="text-sm font-medium text-slate-600">
                    Purchase date
                  </p>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="text-base text-slate-900">
                      {job.warrantyPurchaseDate
                        ? formatDate(job.warrantyPurchaseDate)
                        : "—"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditingPurchaseDate(true)}
                      className="text-sm font-medium text-sky-700 hover:underline"
                    >
                      {job.warrantyPurchaseDate ? "Edit" : "Add"}
                    </button>
                  </div>
                </div>
              )
            ) : (
              <DetailRow label="Purchase date">
                {job.warrantyPurchaseDate
                  ? formatDate(job.warrantyPurchaseDate)
                  : "—"}
              </DetailRow>
            )}
          </DetailSection>
        ) : job.status === "Outsourced" && job.outsourcedTo ? (
          <DetailSection title="Outsource Partner">
            <p className="text-base font-medium text-purple-800">
              With {job.outsourcedTo.name}
            </p>
            {job.outsourcedAt && (
              <p className="text-sm text-slate-500">
                Sent {formatDateTime(job.outsourcedAt)}
              </p>
            )}
          </DetailSection>
        ) : (
          <DetailSection title="Assigned Technician">
            <p className="text-base text-slate-900">
              {job.assignedTechnician?.name ?? "—"}
            </p>
          </DetailSection>
        )}

        {job.completedByOutsource ? (
          <DetailSection title="Completed By (Outsource)">
            <p className="text-base text-slate-900">{job.completedByOutsource.name}</p>
          </DetailSection>
        ) : (
          <DetailSection title="Completed By Technician">
            <p className="text-base text-slate-900">
              {job.completedByTechnician?.name ?? "—"}
            </p>
          </DetailSection>
        )}

        {showFinancials && (
          <DetailSection title="Service Amount">
            {job.serviceAmount != null ? (
              <p className="text-xl font-semibold text-emerald-700">
                {formatCurrency(job.serviceAmount)}
                {job.readyAt && !isAdmin && (
                  <span className="ml-2 text-sm font-normal text-slate-400">
                    (locked)
                  </span>
                )}
              </p>
            ) : (
              <p className="text-base text-slate-500">Not set</p>
            )}
          </DetailSection>
        )}

        {(job.remarks || !isLocked) && (
          <DetailSection title="Remarks">
            {!isLocked ? (
              <div className="space-y-3">
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Motor replaced, waiting for spare, customer informed"
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
                <button
                  onClick={handleSaveRemarks}
                  disabled={saving}
                  className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
                >
                  Save Remarks
                </button>
              </div>
            ) : (
              <p className="text-base leading-relaxed text-slate-700">
                {job.remarks}
              </p>
            )}
          </DetailSection>
        )}

        {photos.length > 0 && (
          <DetailSection title="Product Photos">
            <div className="flex flex-wrap gap-3">
              {photos.map((photo, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={photo}
                  alt={`Product ${i + 1}`}
                  className="h-28 w-28 rounded-md border border-slate-200 object-cover"
                />
              ))}
            </div>
          </DetailSection>
        )}

        {isLocked && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            This job is delivered and locked. Only admin can reopen it.
          </div>
        )}

        {canAdminEditAmount && !showAmountEdit && (
          <button
            type="button"
            onClick={() => setShowAmountEdit(true)}
            className="w-full rounded-md border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit Service Amount (Admin)
          </button>
        )}

        {isAdmin && job.readyAt && !showCompletedByEdit && (
          <button
            type="button"
            onClick={() => setShowCompletedByEdit(true)}
            className="w-full rounded-md border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit Completed By (Admin)
          </button>
        )}

        {showCompletedByEdit && isAdmin && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-900">Edit Completed By</h3>
            <select
              value={editCompletedById}
              onChange={(e) => setEditCompletedById(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <option value="">Not set</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleSaveCompletedBy}
                disabled={saving}
                className="flex-1 rounded-md bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setShowCompletedByEdit(false)}
                className="flex-1 rounded-md border border-slate-300 bg-white py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showAmountEdit && isAdmin && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-amber-900">Edit Service Amount</h3>
            <input
              type="number"
              min="0"
              step="1"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveAmount}
                disabled={saving}
                className="flex-1 rounded-md bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Save Amount
              </button>
              <button
                onClick={() => setShowAmountEdit(false)}
                className="flex-1 rounded-md border border-slate-300 bg-white py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isStaff && (
          <DetailSection title="Notification Settings">
            <JobNotificationSettings
              jobId={job.id}
              customerId={job.customer.id}
              customerMobile={job.customer.mobile}
              customerAllows={job.customer.allowWhatsappNotifications ?? true}
              jobOverride={job.whatsappNotificationsOverride}
              onCustomerPreferenceChange={(allows) =>
                setJob((prev) =>
                  prev
                    ? {
                        ...prev,
                        customer: {
                          ...prev.customer,
                          allowWhatsappNotifications: allows,
                        },
                      }
                    : prev
                )
              }
              onJobOverrideChange={(override) =>
                setJob((prev) =>
                  prev ? { ...prev, whatsappNotificationsOverride: override } : prev
                )
              }
            />
          </DetailSection>
        )}

        {job.statusHistory.length > 0 && (
          <DetailSection title="Status History">
            <div className="space-y-4">
              {job.statusHistory.map((entry) => (
                <div key={entry.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <JobStatusBadge status={entry.status} />
                    <p className="text-xs text-slate-500">
                      {new Date(entry.changedAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Updated by: {formatStatusChangedBy(entry.changedBy)}
                  </p>
                  {entry.note && (
                    <p className="mt-0.5 text-sm text-slate-500">{entry.note}</p>
                  )}
                </div>
              ))}
            </div>
          </DetailSection>
        )}
      </div>
    </AppShell>
  );
}
