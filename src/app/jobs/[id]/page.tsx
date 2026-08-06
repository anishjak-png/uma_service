"use client";

import { AppShell } from "@/components/AppShell";
import { AccessoryQtyInput } from "@/components/AccessoryQtyInput";
import { CallCustomerButton } from "@/components/CallCustomerButton";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { ReceiptActions } from "@/components/ReceiptActions";
import { WhatsAppActions } from "@/components/WhatsAppActions";
import { JobNotificationSettings } from "@/components/JobNotificationSettings";
import {
  getSelectableStatuses,
  isDeliveredTerminal,
  MAX_PRODUCT_PHOTOS,
  MAX_WARRANTY_CARD_PHOTOS,
  STATUS_LABELS,
  type JobStatusValue,
  type StaffRole,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/currency";
import {
  daysSince,
  formatMobileDisplay,
  formatStatusChangedBy,
  formatDate,
  formatDateTime,
  parseProductPhotos,
  parseWarrantyCardPhotos,
  parseAccessories,
  toDateInputValue,
  type AccessoryItem,
} from "@/lib/jobs";
import {
  isNativeApp,
  isPhotoPickerCancelled,
  pickNativePhoto,
} from "@/lib/native-photo";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

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
  warrantyCardPhotos?: string | null;
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

function CompactCard({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${className}`}
    >
      {title ? (
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
      ) : null}
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function CompactRow({
  label,
  children,
  className = "",
  title,
  wrap = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  title?: string;
  wrap?: boolean;
}) {
  return (
    <div className={`flex gap-2 text-sm leading-snug ${wrap ? "items-start" : "items-center"} ${className}`}>
      <span className="w-[5.5rem] shrink-0 text-xs font-medium text-slate-500">
        {label}
      </span>
      <span
        className={`min-w-0 flex-1 text-slate-900 ${wrap ? "whitespace-normal break-words text-xs leading-snug" : "truncate"}`}
        title={title}
      >
        {children}
      </span>
    </div>
  );
}

const STATUS_ACTION_ORDER: JobStatusValue[] = [
  "Ready",
  "WaitingForCustomerApproval",
  "Return",
  "Outsourced",
  "WarrantyPending",
];

function sortStatusActions(statuses: JobStatusValue[]): JobStatusValue[] {
  const order = new Map(STATUS_ACTION_ORDER.map((status, index) => [status, index]));
  return [...statuses].sort(
    (a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99)
  );
}

function getStatusActionLabel(status: JobStatusValue, isWarranty: boolean): string {
  if (status === "WarrantyPending") {
    return isWarranty ? "Warranty (at store)" : "Warranty";
  }
  return STATUS_ACTION_LABELS[status] ?? STATUS_LABELS[status];
}

function getStatusActionColor(status: JobStatusValue): string {
  if (status === "Outsourced") return "bg-purple-600 hover:bg-purple-700";
  if (status === "WarrantyPending") return "bg-sky-600 hover:bg-sky-700";
  return "bg-emerald-600 hover:bg-emerald-700";
}

function formatAccessoryWithQty(item: AccessoryItem): string {
  return `${item.name} × ${item.qty}`;
}

const STATUS_ACTION_LABELS: Partial<Record<JobStatusValue, string>> = {
  Ready: "Ready",
  WaitingForCustomerApproval: "Waiting for approval",
  Return: "Return",
  Outsourced: "Outsourced",
  WarrantyPending: "Warranty",
};

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
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [showAssigneeEdit, setShowAssigneeEdit] = useState(false);
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
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [warrantyPhotoUploading, setWarrantyPhotoUploading] = useState(false);
  const [warrantyPhotoError, setWarrantyPhotoError] = useState("");
  const productPhotoInputRef = useRef<HTMLInputElement>(null);
  const warrantyPhotoInputRef = useRef<HTMLInputElement>(null);

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
    setEditAssigneeId(data.assignedTechnician?.id ?? "");
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
      setShowAssigneeEdit(false);
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

  async function handleSaveAssignee() {
    await updateJob({
      assignedTechnicianId: editAssigneeId || null,
    });
    setShowAssigneeEdit(false);
  }

  async function uploadProductPhotoFiles(files: File[]) {
    if (!job || files.length === 0) return;
    const existing = parseProductPhotos(job.productPhotos);
    const remaining = MAX_PRODUCT_PHOTOS - existing.length;
    if (remaining <= 0) return;

    setPhotoUploading(true);
    setPhotoError("");
    const formData = new FormData();
    files.slice(0, remaining).forEach((file) => formData.append("photos", file));

    try {
      const res = await fetch(`/api/jobs/${job.id}/product-photos`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhotoError(data.error ?? "Failed to upload photos");
        return;
      }
      if (Array.isArray(data.productPhotos)) {
        setJob((prev) =>
          prev
            ? { ...prev, productPhotos: JSON.stringify(data.productPhotos) }
            : prev
        );
      }
    } catch {
      setPhotoError("Failed to upload photos");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function addProductPhoto() {
    if (!job || photoUploading) return;
    const existing = parseProductPhotos(job.productPhotos);
    if (existing.length >= MAX_PRODUCT_PHOTOS) return;

    if (isNativeApp()) {
      try {
        const file = await pickNativePhoto();
        if (file) await uploadProductPhotoFiles([file]);
      } catch (err) {
        if (!isPhotoPickerCancelled(err)) {
          setPhotoError(
            err instanceof Error ? err.message : "Could not open camera"
          );
        }
      }
      return;
    }
    productPhotoInputRef.current?.click();
  }

  async function uploadWarrantyCardPhotoFiles(files: File[]) {
    if (!job || files.length === 0) return;
    const existing = parseWarrantyCardPhotos(job.warrantyCardPhotos);
    const remaining = MAX_WARRANTY_CARD_PHOTOS - existing.length;
    if (remaining <= 0) return;

    setWarrantyPhotoUploading(true);
    setWarrantyPhotoError("");
    const formData = new FormData();
    files.slice(0, remaining).forEach((file) => formData.append("photos", file));

    try {
      const res = await fetch(`/api/jobs/${job.id}/warranty-card-photos`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWarrantyPhotoError(data.error ?? "Failed to upload warranty photos");
        return;
      }
      if (Array.isArray(data.warrantyCardPhotos)) {
        setJob((prev) =>
          prev
            ? {
                ...prev,
                warrantyCardPhotos: JSON.stringify(data.warrantyCardPhotos),
              }
            : prev
        );
      }
    } catch {
      setWarrantyPhotoError("Failed to upload warranty photos");
    } finally {
      setWarrantyPhotoUploading(false);
    }
  }

  async function addWarrantyCardPhoto() {
    if (!job || warrantyPhotoUploading || !job.isWarranty) return;
    const existing = parseWarrantyCardPhotos(job.warrantyCardPhotos);
    if (existing.length >= MAX_WARRANTY_CARD_PHOTOS) return;

    if (isNativeApp()) {
      try {
        const file = await pickNativePhoto();
        if (file) await uploadWarrantyCardPhotoFiles([file]);
      } catch (err) {
        if (!isPhotoPickerCancelled(err)) {
          setWarrantyPhotoError(
            err instanceof Error ? err.message : "Could not open camera"
          );
        }
      }
      return;
    }
    warrantyPhotoInputRef.current?.click();
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
  const canConvertToWarranty =
    !job.isWarranty && selectableStatuses.includes("WarrantyPending");
  const statusActionStatuses = canConvertToWarranty
    ? selectableStatuses.filter((status) => status !== "WarrantyPending")
    : selectableStatuses;
  const orderedStatusActions = sortStatusActions([
    ...statusActionStatuses,
    ...(canConvertToWarranty ? (["WarrantyPending"] as JobStatusValue[]) : []),
  ]);
  const backHref = role === "technician" ? "/jobs/pending?scope=my" : "/jobs/search";
  const photos = parseProductPhotos(job.productPhotos);
  const warrantyCardPhotos = parseWarrantyCardPhotos(job.warrantyCardPhotos);
  const isStaff = role === "reception" || role === "admin";
  const isAdmin = role === "admin";
  const showFinancials = isStaff || isAdmin;
  const isLocked = isDeliveredTerminal(job.status) && !isAdmin;
  const canAdminEditAmount = isAdmin && job.readyAt != null && !isLocked;
  const canEditAssignee =
    isStaff && !isLocked && !job.isWarranty && job.status !== "Outsourced";

  const accessories = parseAccessories(job.accessories);
  const productLine = [job.brand, job.applianceType, job.model]
    .filter(Boolean)
    .join(" · ");
  const assigneeLabel =
    job.isWarranty
      ? job.status === "WarrantyWithCompany"
        ? `With company${job.warrantyTakenAt ? ` · ${formatDateTime(job.warrantyTakenAt)}` : ""}`
        : "At store"
      : job.status === "Outsourced" && job.outsourcedTo
        ? job.outsourcedTo.name
        : job.assignedTechnician?.name ?? "—";
  const completedByLabel =
    job.completedByOutsource?.name ??
    job.completedByTechnician?.name ??
    "—";

  return (
    <AppShell>
      <div className="space-y-2">
        <Link
          href={backHref}
          className="inline-block text-xs font-medium text-emerald-600 hover:underline"
        >
          ← Back
        </Link>

        <CompactCard>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">{job.jobNumber}</h1>
            <JobStatusBadge status={job.status} />
            {showFinancials && job.serviceAmount != null && (
              <span className="ml-auto text-sm font-semibold text-emerald-700">
                {formatCurrency(job.serviceAmount)}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">
            Received {formatDateTime(job.receivedAt)} ({daysSince(new Date(job.receivedAt))}d)
            {job.createdBy ? ` · Created by ${formatStatusChangedBy(job.createdBy)}` : ""}
            {job.readyAt ? ` · Ready ${formatDateTime(job.readyAt)}` : ""}
            {job.deliveredAt ? ` · Delivered ${formatDateTime(job.deliveredAt)}` : ""}
          </p>
        </CompactCard>

        {showReadyForm && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-emerald-900">Mark as Ready</h3>
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
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-purple-900">Send to Outsource</h3>
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
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-sky-900">Convert to Warranty</h3>
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

        <CompactCard title="Actions">
          {!showReadyForm &&
            !showOutsourceForm &&
            !showConvertWarrantyForm && (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {orderedStatusActions.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleStatusChange(status)}
                  disabled={saving}
                  className={`rounded-md py-2 text-xs font-medium text-white disabled:opacity-50 ${getStatusActionColor(status)}`}
                >
                  {getStatusActionLabel(status, Boolean(job.isWarranty))}
                </button>
              ))}
              <ReceiptActions
                counterOnly
                actionTab
                job={{
                  id: job.id,
                  jobNumber: job.jobNumber,
                  receivedAt: job.receivedAt,
                  applianceType: job.applianceType,
                  brand: job.brand,
                  model: job.model,
                  complaint: job.complaint,
                  accessories: job.accessories,
                  customer: job.customer,
                }}
              />
            </div>
          )}

          {(isStaff || role === "technician") && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(job.status === "Ready" || job.status === "Return") && (
                <Link
                  href={`/jobs/delivery?q=${encodeURIComponent(job.jobNumber)}`}
                  className="inline-flex h-8 flex-1 min-w-[5.5rem] items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Delivery
                </Link>
              )}
              {isStaff && (
                <WhatsAppActions jobId={job.id} jobStatus={job.status} compact />
              )}
            </div>
          )}
        </CompactCard>

        <CompactCard title="Details">
          <CompactRow label="Customer">
            {job.customer.name ?? "—"}
          </CompactRow>
          <CompactRow label="Mobile">
            <span className="inline-flex min-w-0 items-center gap-1">
              <span className="truncate">{formatMobileDisplay(job.customer.mobile)}</span>
              <CallCustomerButton mobile={job.customer.mobile} />
            </span>
          </CompactRow>
          <CompactRow label="Product">{productLine || "—"}</CompactRow>

          <div className="flex items-start gap-2 text-sm leading-snug">
            <span className="w-[5.5rem] shrink-0 text-xs font-medium text-slate-500">
              Accessories
            </span>
            <div className="min-w-0 flex-1">
              {!editingAccessories ? (
                <div className="flex min-w-0 items-start gap-2">
                  <p className="whitespace-normal break-words text-xs leading-snug text-slate-900">
                    {accessories.length > 0
                      ? accessories.map(formatAccessoryWithQty).join(", ")
                      : "No accessory"}
                  </p>
                  {!isLocked && isStaff && (
                    <button
                      type="button"
                      onClick={() => {
                        setAccessoryQty(accessoriesToQtyMap(accessories));
                        const other = otherFromAccessories(accessories);
                        setOtherAccessory(other.text);
                        setOtherAccessoryQty(other.qty);
                        setEditingAccessories(true);
                      }}
                      className="shrink-0 text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
              ) : (
                  <div className="space-y-2">
                    {accessoryOptions.length > 0 ? (
                      <div className="max-h-32 space-y-1 overflow-y-auto">
                        {accessoryOptions.map((item) => {
                          const checked = accessoryQty[item] != null;
                          return (
                            <div
                              key={item}
                              className="flex items-center gap-2 text-xs text-slate-700"
                            >
                              <label className="flex min-w-0 flex-1 items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    toggleAccessory(item, e.target.checked)
                                  }
                                  className="h-3.5 w-3.5 rounded border-slate-300"
                                />
                                <span className="truncate">{item}</span>
                              </label>
                              {checked && (
                                <AccessoryQtyInput
                                  value={accessoryQty[item]}
                                  onChange={(qty) => setQty(item, qty)}
                                  className="h-7 w-12 shrink-0 rounded border border-slate-300 px-1 text-center text-xs"
                                  aria-label={`${item} quantity`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        No accessories for this product type.
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={otherAccessory}
                        onChange={(e) => setOtherAccessory(e.target.value)}
                        placeholder="Other item"
                        className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 px-2 text-xs"
                      />
                      {otherAccessory.trim() && (
                        <AccessoryQtyInput
                          value={otherAccessoryQty}
                          onChange={setOtherAccessoryQty}
                          className="h-8 w-12 shrink-0 rounded-md border border-slate-300 px-1 text-center text-xs"
                          aria-label="Other accessory quantity"
                        />
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={saveAccessories}
                        disabled={saving}
                        className="flex-1 rounded-md bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingAccessories(false)}
                        className="flex-1 rounded-md border border-slate-300 py-1.5 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          <CompactRow label="Complaint" title={job.complaint}>
            {job.complaint}
          </CompactRow>
          {job.physicalCondition && (
            <CompactRow label="Condition" title={job.physicalCondition}>
              {job.physicalCondition}
            </CompactRow>
          )}
          <CompactRow
            label={job.isWarranty ? "Warranty" : job.status === "Outsourced" ? "Outsource" : "Assignee"}
            wrap={canEditAssignee && showAssigneeEdit}
          >
            {canEditAssignee && showAssigneeEdit ? (
              <div className="min-w-0 flex-1 space-y-1.5">
                <select
                  value={editAssigneeId}
                  onChange={(e) => setEditAssigneeId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <option value="">Unassigned</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleSaveAssignee}
                    disabled={saving}
                    className="flex-1 rounded-md bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditAssigneeId(job.assignedTechnician?.id ?? "");
                      setShowAssigneeEdit(false);
                    }}
                    className="flex-1 rounded-md border border-slate-300 py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="min-w-0 truncate text-slate-900">
                  {assigneeLabel}
                  {!job.isWarranty && job.status === "Outsourced" && job.outsourcedAt
                    ? ` · ${formatDateTime(job.outsourcedAt)}`
                    : ""}
                </span>
                {canEditAssignee && (
                  <button
                    type="button"
                    onClick={() => setShowAssigneeEdit(true)}
                    className="shrink-0 text-xs font-medium text-emerald-700 hover:underline"
                  >
                    {job.assignedTechnician ? "Change" : "Assign"}
                  </button>
                )}
              </div>
            )}
          </CompactRow>
          <CompactRow label="Completed">{completedByLabel}</CompactRow>

          {job.isWarranty && (
            <div className="flex items-center gap-2 text-sm leading-snug">
              <span className="w-[5.5rem] shrink-0 text-xs font-medium text-slate-500">
                Purchased
              </span>
              <div className="min-w-0 flex-1">
                {isStaff && !isLocked && editingPurchaseDate ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      type="date"
                      value={purchaseDateEdit}
                      onChange={(e) => setPurchaseDateEdit(e.target.value)}
                      className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 px-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={savePurchaseDate}
                      disabled={saving}
                      className="rounded-md bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
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
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-slate-900">
                      {job.warrantyPurchaseDate
                        ? formatDate(job.warrantyPurchaseDate)
                        : "—"}
                    </span>
                    {isStaff && !isLocked && (
                      <button
                        type="button"
                        onClick={() => setEditingPurchaseDate(true)}
                        className="shrink-0 text-xs font-medium text-sky-700 hover:underline"
                      >
                        {job.warrantyPurchaseDate ? "Edit" : "Add"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {(job.remarks || !isLocked) && (
            <div className="flex items-start gap-2 text-sm leading-snug">
              <span className="w-[5.5rem] shrink-0 text-xs font-medium text-slate-500">
                Remarks
              </span>
              <div className="min-w-0 flex-1">
                {!isLocked ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Notes for this job"
                      rows={2}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    />
                    <button
                      onClick={handleSaveRemarks}
                      disabled={saving}
                      className="h-7 w-full rounded-md bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Save Remarks
                    </button>
                  </div>
                ) : (
                  <p className="truncate text-slate-900">{job.remarks}</p>
                )}
              </div>
            </div>
          )}
        </CompactCard>

        <CompactCard title="Product photos">
          {photos.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {photos.map((photo, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={photo}
                  src={photo}
                  alt={`Product ${i + 1}`}
                  className="h-14 w-14 rounded border border-slate-200 object-cover"
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No product photos yet</p>
          )}
          {isStaff && !isLocked && photos.length < MAX_PRODUCT_PHOTOS && (
            <div className="mt-2 space-y-1.5">
              <input
                ref={productPhotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                aria-hidden
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files?.length) return;
                  await uploadProductPhotoFiles(Array.from(files));
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={addProductPhoto}
                disabled={photoUploading}
                className="w-full rounded-md border border-dashed border-emerald-400 bg-emerald-50 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                {photoUploading
                  ? "Uploading…"
                  : `Add photo (${photos.length}/${MAX_PRODUCT_PHOTOS})`}
              </button>
              {photoError && (
                <p className="text-xs text-red-600">{photoError}</p>
              )}
            </div>
          )}
        </CompactCard>

        {job.isWarranty && (
          <CompactCard title="Warranty card photos">
            {warrantyCardPhotos.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {warrantyCardPhotos.map((photo, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photo}
                    src={photo}
                    alt={`Warranty card ${i + 1}`}
                    className="h-14 w-14 rounded border border-sky-200 object-cover"
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No warranty card photos yet</p>
            )}
            {isStaff &&
              !isLocked &&
              warrantyCardPhotos.length < MAX_WARRANTY_CARD_PHOTOS && (
                <div className="mt-2 space-y-1.5">
                  <input
                    ref={warrantyPhotoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="sr-only"
                    aria-hidden
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files?.length) return;
                      await uploadWarrantyCardPhotoFiles(Array.from(files));
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={addWarrantyCardPhoto}
                    disabled={warrantyPhotoUploading}
                    className="w-full rounded-md border border-dashed border-sky-400 bg-sky-50 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
                  >
                    {warrantyPhotoUploading
                      ? "Uploading…"
                      : `Add warranty photo (${warrantyCardPhotos.length}/${MAX_WARRANTY_CARD_PHOTOS})`}
                  </button>
                  {warrantyPhotoError && (
                    <p className="text-xs text-red-600">{warrantyPhotoError}</p>
                  )}
                </div>
              )}
          </CompactCard>
        )}

        {isLocked && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Delivered and locked — admin can reopen.
          </p>
        )}

        {(canAdminEditAmount && !showAmountEdit) ||
        (isAdmin && job.readyAt && !showCompletedByEdit) ? (
          <div className="flex flex-wrap gap-1.5">
            {canAdminEditAmount && !showAmountEdit && (
              <button
                type="button"
                onClick={() => setShowAmountEdit(true)}
                className="flex-1 rounded-md border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit Amount
              </button>
            )}
            {isAdmin && job.readyAt && !showCompletedByEdit && (
              <button
                type="button"
                onClick={() => setShowCompletedByEdit(true)}
                className="flex-1 rounded-md border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit Completed By
              </button>
            )}
          </div>
        ) : null}

        {showCompletedByEdit && isAdmin && (
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Edit Completed By</h3>
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
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-amber-900">Edit Service Amount</h3>
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
          <details className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notifications
            </summary>
            <div className="border-t border-slate-100 px-3 pb-3 pt-2">
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
            </div>
          </details>
        )}

        {job.statusHistory.length > 0 && (
          <details className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status history ({job.statusHistory.length})
            </summary>
            <div className="space-y-2 border-t border-slate-100 px-3 pb-3 pt-2">
              {job.statusHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <JobStatusBadge status={entry.status} />
                    <p className="shrink-0 text-[10px] text-slate-500">
                      {new Date(entry.changedAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-600">
                    {formatStatusChangedBy(entry.changedBy)}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </AppShell>
  );
}
