import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveStoredBillSplit } from "@/lib/currency";

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const PAUSE_STATUSES = new Set([
  "WaitingForCustomerApproval",
  "Outsourced",
  "WarrantyWithCompany",
]);

const COMPLETED_STATUSES = new Set(["Ready", "Return", "Delivered"]);

export const PERFORMANCE_NOTES = [
  "Each service job is counted once. A return stays on the same job and is not a new job.",
  "Assigned month uses complaint date (receivedAt). There is no separate assigned-at timestamp.",
  "Completed month uses readyAt, even if the job was received in an earlier month.",
  "Completed work is attributed to the technician who marked it Ready (completedBy). If that person differs from the assignee, the job is flagged and the value is not added to both.",
  "Completed means Ready, Return, or Delivered. Ready is finished but not handed over. Pending and Waiting for approval are not completed.",
  "There is no In Progress or Cancelled status. Deleted jobs are excluded from totals and shown separately.",
  "Service value is the stored job total (serviceAmount). Labour is serviceCharge and spares are sparesAmount when a split was saved. This is not amount collected. Discount, other charges, and customer feedback are not recorded.",
  "Completion time is received → ready, minus time spent in Waiting for approval, Outsourced, or Warranty with company (from status history). Spare-parts delay and customer-not-available pauses are not recorded. Missing timestamps are excluded, not treated as zero.",
  "No SLA target is configured, so within-SLA / over-SLA counts are not shown.",
];

export type PerformanceView = "assigned" | "completed";

export type PerformanceFilters = {
  year: number;
  month: number;
  view: PerformanceView;
  technicianId?: string;
  applianceType?: string;
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  includeJobs?: boolean;
};

export type PerformanceJob = {
  id: string;
  jobNumber: string;
  customerName: string;
  customerPhone: string;
  product: string;
  complaint: string;
  receivedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  assignedTechnician: string;
  completedByTechnician: string;
  multipleTechnicians: boolean;
  applianceType: string;
  status: string;
  classification: string;
  serviceValue: number | null;
  labour: number | null;
  spares: number | null;
  valueMissing: boolean;
  grossMs: number | null;
  benchMs: number | null;
  pendingMs: number | null;
  returned: boolean;
  firstTimeCompleted: boolean;
};

export type TechnicianPerformanceRow = {
  id: string;
  name: string;
  jobsAssigned: number;
  jobsCompleted: number;
  firstTimeCompleted: number;
  jobsDelivered: number;
  notDelivered: number;
  pendingJobs: number;
  returnedJobs: number;
  cancelledJobs: number;
  inProgressJobs: number;
  openOther: number;
  serviceValue: number;
  jobsWithValue: number;
  jobsMissingValue: number;
  averageServiceValue: number | null;
  averageCompletionMs: number | null;
  medianCompletionMs: number | null;
  fastestMs: number | null;
  slowestMs: number | null;
  completionRate: number | null;
  deliveryRate: number | null;
  returnRate: number | null;
};

export type PerformanceSummary = {
  totalJobs: number;
  completed: number;
  delivered: number;
  notDelivered: number;
  pending: number;
  returned: number;
  inProgress: number;
  deleted: number;
  serviceValue: number;
  jobsWithValue: number;
  jobsMissingValue: number;
  averageCompletionMs: number | null;
  medianCompletionMs: number | null;
};

export type PerformanceReport = {
  view: PerformanceView;
  rangeLabel: string;
  start: string;
  end: string;
  notes: string[];
  summary: PerformanceSummary;
  technicians: TechnicianPerformanceRow[];
  jobs: PerformanceJob[];
  trend: Array<{ label: string; serviceValue: number; completed: number }>;
  appliances: string[];
  technicianOptions: Array<{ id: string; name: string }>;
  deletedInRange: number;
};

type HistoryRow = { status: string; changedAt: Date };

type SourceJob = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand: string;
  complaint: string;
  serviceAmount: number | null;
  serviceCharge: number | null;
  sparesAmount: number | null;
  receivedAt: Date;
  readyAt: Date | null;
  deliveredAt: Date | null;
  assignedTechnicianId: string | null;
  completedByTechnicianId: string | null;
  assignedTechnician: { id: string; name: string } | null;
  completedByTechnician: { id: string; name: string } | null;
  customer: { name: string | null; mobile: string };
  statusHistory: HistoryRow[];
};

export function istParts(date = new Date()) {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth() + 1,
    day: ist.getUTCDate(),
  };
}

export function previousIstMonth(date = new Date()) {
  const { year, month } = istParts(date);
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export function istRangeFromParts(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
}

export function monthRange(year: number, month: number) {
  const start = istRangeFromParts(year, month, 1);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = istRangeFromParts(nextYear, nextMonth, 1);
  return { start, end };
}

export function parseIsoDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return istRangeFromParts(year, month, day);
}

export function formatIstDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${ist.getUTCFullYear()}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const mins = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(mins / (60 * 24));
  const hours = Math.floor((mins % (60 * 24)) / 60);
  const minutes = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function benchMilliseconds(
  receivedAt: Date,
  readyAt: Date | null,
  history: HistoryRow[]
): { grossMs: number | null; benchMs: number | null } {
  if (!readyAt) return { grossMs: null, benchMs: null };
  const start = receivedAt.getTime();
  const end = readyAt.getTime();
  if (end < start) return { grossMs: null, benchMs: null };

  const events = [...history].sort(
    (a, b) => a.changedAt.getTime() - b.changedAt.getTime()
  );
  let pause = 0;
  let cursor = start;
  let current = "Pending";
  for (const event of events) {
    const at = event.changedAt.getTime();
    if (at <= start) {
      current = event.status;
      continue;
    }
    const mark = Math.min(end, at);
    if (PAUSE_STATUSES.has(current)) pause += mark - cursor;
    cursor = mark;
    current = event.status;
    if (at >= end) break;
  }
  if (cursor < end && PAUSE_STATUSES.has(current)) pause += end - cursor;
  return { grossMs: end - start, benchMs: Math.max(0, end - start - pause) };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function classifyStatus(status: string): string {
  if (status === "Delivered") return "Delivered";
  if (status === "Ready") return "Not delivered";
  if (status === "Return") return "Returned";
  if (status === "Pending" || status === "WaitingForCustomerApproval") {
    return "Pending";
  }
  if (status === "Deleted") return "Deleted";
  if (status === "Outsourced") return "Outsourced";
  if (status === "WarrantyPending" || status === "WarrantyWithCompany") {
    return "Warranty";
  }
  return status;
}

function wasReturned(status: string, history: HistoryRow[]) {
  return status === "Return" || history.some((row) => row.status === "Return");
}

function attributeId(job: SourceJob, view: PerformanceView) {
  if (view === "completed") {
    return (
      job.completedByTechnicianId ??
      job.assignedTechnicianId ??
      "__unassigned__"
    );
  }
  return job.assignedTechnicianId ?? "__unassigned__";
}

function attributeName(job: SourceJob, view: PerformanceView) {
  if (view === "completed") {
    return (
      job.completedByTechnician?.name ??
      job.assignedTechnician?.name ??
      "Unassigned"
    );
  }
  return job.assignedTechnician?.name ?? "Unassigned";
}

function toPerformanceJob(job: SourceJob): PerformanceJob {
  const split = resolveStoredBillSplit(job);
  const times = benchMilliseconds(job.receivedAt, job.readyAt, job.statusHistory);
  const returned = wasReturned(job.status, job.statusHistory);
  const completed = COMPLETED_STATUSES.has(job.status) || Boolean(job.readyAt);
  const now = Date.now();
  const pendingMs =
    job.status === "Pending" || job.status === "WaitingForCustomerApproval"
      ? Math.max(0, now - job.receivedAt.getTime())
      : null;
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    customerName: job.customer.name?.trim() || "—",
    customerPhone: job.customer.mobile,
    product: [job.brand, job.applianceType].filter(Boolean).join(" "),
    complaint: job.complaint,
    receivedAt: job.receivedAt.toISOString(),
    readyAt: job.readyAt?.toISOString() ?? null,
    deliveredAt: job.deliveredAt?.toISOString() ?? null,
    assignedTechnician: job.assignedTechnician?.name ?? "Unassigned",
    completedByTechnician: job.completedByTechnician?.name ?? "—",
    multipleTechnicians: Boolean(
      job.assignedTechnicianId &&
        job.completedByTechnicianId &&
        job.assignedTechnicianId !== job.completedByTechnicianId
    ),
    applianceType: job.applianceType,
    status: job.status,
    classification: classifyStatus(job.status),
    serviceValue: job.serviceAmount,
    labour: split.hasSplit ? split.serviceCharge : null,
    spares: split.hasSplit ? split.sparesAmount : null,
    valueMissing: job.serviceAmount == null,
    grossMs: times.grossMs,
    benchMs: times.benchMs,
    pendingMs,
    returned,
    firstTimeCompleted: completed && !returned,
  };
}

function rowFromJobs(
  id: string,
  name: string,
  jobs: PerformanceJob[]
): TechnicianPerformanceRow {
  const completed = jobs.filter(
    (job) => COMPLETED_STATUSES.has(job.status) || Boolean(job.readyAt)
  );
  const delivered = jobs.filter((job) => job.status === "Delivered");
  const valued = jobs.filter((job) => job.serviceValue != null);
  const times = jobs
    .map((job) => job.benchMs)
    .filter((ms): ms is number => ms != null);
  const serviceValue = valued.reduce(
    (sum, job) => sum + (job.serviceValue ?? 0),
    0
  );
  const returned = jobs.filter((job) => job.returned).length;
  return {
    id,
    name,
    jobsAssigned: jobs.length,
    jobsCompleted: completed.length,
    firstTimeCompleted: jobs.filter((job) => job.firstTimeCompleted).length,
    jobsDelivered: delivered.length,
    notDelivered: jobs.filter((job) => job.status === "Ready").length,
    pendingJobs: jobs.filter(
      (job) =>
        job.status === "Pending" ||
        job.status === "WaitingForCustomerApproval"
    ).length,
    returnedJobs: returned,
    cancelledJobs: 0,
    inProgressJobs: 0,
    openOther: jobs.filter((job) =>
      ["Outsourced", "WarrantyPending", "WarrantyWithCompany"].includes(
        job.status
      )
    ).length,
    serviceValue,
    jobsWithValue: valued.length,
    jobsMissingValue: jobs.length - valued.length,
    averageServiceValue: valued.length ? serviceValue / valued.length : null,
    averageCompletionMs: average(times),
    medianCompletionMs: median(times),
    fastestMs: times.length ? Math.min(...times) : null,
    slowestMs: times.length ? Math.max(...times) : null,
    completionRate: jobs.length ? completed.length / jobs.length : null,
    deliveryRate: completed.length ? delivered.length / completed.length : null,
    returnRate: jobs.length ? returned / jobs.length : null,
  };
}

function summarize(jobs: PerformanceJob[]): PerformanceSummary {
  const valued = jobs.filter((job) => job.serviceValue != null);
  const times = jobs
    .map((job) => job.benchMs)
    .filter((ms): ms is number => ms != null);
  return {
    totalJobs: jobs.length,
    completed: jobs.filter(
      (job) => COMPLETED_STATUSES.has(job.status) || Boolean(job.readyAt)
    ).length,
    delivered: jobs.filter((job) => job.status === "Delivered").length,
    notDelivered: jobs.filter((job) => job.status === "Ready").length,
    pending: jobs.filter(
      (job) =>
        job.status === "Pending" ||
        job.status === "WaitingForCustomerApproval"
    ).length,
    returned: jobs.filter((job) => job.returned).length,
    inProgress: 0,
    deleted: 0,
    serviceValue: valued.reduce((sum, job) => sum + (job.serviceValue ?? 0), 0),
    jobsWithValue: valued.length,
    jobsMissingValue: jobs.length - valued.length,
    averageCompletionMs: average(times),
    medianCompletionMs: median(times),
  };
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function searchWhere(q: string) {
  const trimmed = q.trim();
  const digits = trimmed.replace(/\D/g, "");
  const or: Array<Record<string, unknown>> = [
    { jobNumber: { contains: trimmed, mode: "insensitive" } },
    { brand: { contains: trimmed, mode: "insensitive" } },
    { applianceType: { contains: trimmed, mode: "insensitive" } },
    { customer: { name: { contains: trimmed, mode: "insensitive" } } },
  ];
  if (digits.length >= 4) {
    or.push({ customer: { mobile: { contains: digits } } });
  }
  return { OR: or };
}

const jobSelect = {
  id: true,
  jobNumber: true,
  status: true,
  applianceType: true,
  brand: true,
  complaint: true,
  serviceAmount: true,
  serviceCharge: true,
  sparesAmount: true,
  receivedAt: true,
  readyAt: true,
  deliveredAt: true,
  assignedTechnicianId: true,
  completedByTechnicianId: true,
  assignedTechnician: { select: { id: true, name: true } },
  completedByTechnician: { select: { id: true, name: true } },
  customer: { select: { name: true, mobile: true } },
  statusHistory: {
    select: { status: true, changedAt: true },
    orderBy: { changedAt: "asc" as const },
  },
};

export async function loadTechnicianPerformance(
  filters: PerformanceFilters
): Promise<PerformanceReport> {
  const month = monthRange(filters.year, filters.month);
  const from = parseIsoDate(filters.from);
  const to = parseIsoDate(filters.to);
  const start = from ?? month.start;
  const end = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000) : month.end;
  const view = filters.view;

  const dateFilter =
    view === "assigned"
      ? { receivedAt: { gte: start, lt: end } }
      : { readyAt: { gte: start, lt: end } };

  const technicianFilter = !filters.technicianId
    ? {}
    : filters.technicianId === "__unassigned__"
      ? view === "assigned"
        ? { assignedTechnicianId: null }
        : { completedByTechnicianId: null, assignedTechnicianId: null }
      : view === "assigned"
        ? { assignedTechnicianId: filters.technicianId }
        : {
            OR: [
              { completedByTechnicianId: filters.technicianId },
              {
                completedByTechnicianId: null,
                assignedTechnicianId: filters.technicianId,
              },
            ],
          };

  const where = {
    AND: [
      dateFilter,
      technicianFilter,
      filters.applianceType ? { applianceType: filters.applianceType } : {},
      filters.status
        ? { status: filters.status as JobStatus }
        : { status: { not: "Deleted" as const } },
      filters.q?.trim() ? searchWhere(filters.q) : {},
    ],
  };

  const trendStart = monthRange(
    filters.month <= 5 ? filters.year - 1 : filters.year,
    ((filters.month - 6 + 12) % 12) + 1
  ).start;

  const [jobs, deletedInRange, trendJobs, appliances, technicians] =
    await Promise.all([
      prisma.jobCard.findMany({
        where,
        select: jobSelect,
        orderBy: { receivedAt: "asc" },
      }),
      prisma.jobCard.count({
        where: {
          status: "Deleted",
          ...(view === "assigned"
            ? { receivedAt: { gte: start, lt: end } }
            : { readyAt: { gte: start, lt: end } }),
        },
      }),
      prisma.jobCard.findMany({
        where: {
          status: { not: "Deleted" },
          readyAt: { gte: trendStart, lt: end },
          ...(filters.applianceType
            ? { applianceType: filters.applianceType }
            : {}),
        },
        select: {
          readyAt: true,
          serviceAmount: true,
          completedByTechnicianId: true,
          assignedTechnicianId: true,
        },
      }),
      prisma.lookupOption.findMany({
        where: { category: "appliance" },
        select: { value: true },
        orderBy: { value: "asc" },
      }),
      prisma.technician.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const performanceJobs = (jobs as SourceJob[]).map(toPerformanceJob);
  const grouped = new Map<string, PerformanceJob[]>();
  (jobs as SourceJob[]).forEach((job, index) => {
    const id = attributeId(job, view);
    const list = grouped.get(id) ?? [];
    list.push(performanceJobs[index]);
    grouped.set(id, list);
  });

  const nameById = new Map(technicians.map((tech) => [tech.id, tech.name]));
  nameById.set("__unassigned__", "Unassigned");
  for (const job of jobs as SourceJob[]) {
    const id = attributeId(job, view);
    if (!nameById.has(id)) nameById.set(id, attributeName(job, view));
  }

  const rows = [...grouped.entries()]
    .map(([id, list]) => rowFromJobs(id, nameById.get(id) ?? "Unknown", list))
    .sort((a, b) => b.serviceValue - a.serviceValue || a.name.localeCompare(b.name));

  const trendMap = new Map<string, { serviceValue: number; completed: number }>();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const cursor = filters.month - offset;
    const year = cursor <= 0 ? filters.year - 1 : filters.year;
    const monthNumber = ((cursor - 1 + 12) % 12) + 1;
    trendMap.set(`${year}-${monthNumber}`, { serviceValue: 0, completed: 0 });
  }
  for (const job of trendJobs) {
    if (!job.readyAt) continue;
    if (filters.technicianId === "__unassigned__") {
      if (job.completedByTechnicianId || job.assignedTechnicianId) continue;
    } else if (filters.technicianId) {
      const owner =
        job.completedByTechnicianId ?? job.assignedTechnicianId ?? "";
      if (owner !== filters.technicianId) continue;
    }
    const parts = istParts(job.readyAt);
    const key = `${parts.year}-${parts.month}`;
    const bucket = trendMap.get(key);
    if (!bucket) continue;
    bucket.completed += 1;
    if (job.serviceAmount != null) bucket.serviceValue += job.serviceAmount;
  }

  const rangeLabel = from || to
    ? `${formatIstDate(start)} – ${formatIstDate(new Date(end.getTime() - 1))}`
    : monthLabel(filters.year, filters.month);

  return {
    view,
    rangeLabel,
    start: start.toISOString(),
    end: end.toISOString(),
    notes: PERFORMANCE_NOTES,
    summary: { ...summarize(performanceJobs), deleted: deletedInRange },
    technicians: rows,
    jobs: filters.includeJobs ? performanceJobs : [],
    trend: [...trendMap.entries()].map(([key, value]) => {
      const [year, monthNumber] = key.split("-").map(Number);
      return { label: monthLabel(year, monthNumber), ...value };
    }),
    appliances: appliances.map((row) => row.value),
    technicianOptions: technicians,
    deletedInRange,
  };
}
