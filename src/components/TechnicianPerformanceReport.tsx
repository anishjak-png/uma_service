"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type View = "assigned" | "completed";
type SortKey =
  | "serviceValue"
  | "jobsCompleted"
  | "jobsDelivered"
  | "pendingJobs"
  | "averageCompletionMs"
  | "completionRate";

type Row = {
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
  serviceValue: number;
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

type JobRow = {
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
  status: string;
  classification: string;
  serviceValue: number | null;
  labour: number | null;
  spares: number | null;
  valueMissing: boolean;
  benchMs: number | null;
  grossMs: number | null;
  pendingMs: number | null;
  returned: boolean;
};

type Report = {
  view: View;
  rangeLabel: string;
  notes: string[];
  summary: {
    totalJobs: number;
    completed: number;
    delivered: number;
    notDelivered: number;
    pending: number;
    returned: number;
    inProgress: number;
    deleted: number;
    serviceValue: number;
    jobsMissingValue: number;
    averageCompletionMs: number | null;
    medianCompletionMs: number | null;
  };
  technicians: Row[];
  jobs: JobRow[];
  trend: Array<{ label: string; serviceValue: number; completed: number }>;
  appliances: string[];
  technicianOptions: Array<{ id: string; name: string }>;
};

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const STATUSES = [
  "Pending",
  "WaitingForCustomerApproval",
  "Ready",
  "Return",
  "Delivered",
  "Outsourced",
  "WarrantyPending",
  "WarrantyWithCompany",
];

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: "serviceValue", label: "Highest service value" },
  { id: "jobsCompleted", label: "Highest completed" },
  { id: "jobsDelivered", label: "Highest delivered" },
  { id: "pendingJobs", label: "Lowest pending" },
  { id: "averageCompletionMs", label: "Fastest completion" },
  { id: "completionRate", label: "Highest completion rate" },
];

function previousMonth() {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const month = ist.getUTCMonth() + 1;
  const year = ist.getUTCFullYear();
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function formatIstDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${ist.getUTCFullYear()}`;
}

function formatDuration(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const mins = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(mins / (60 * 24));
  const hours = Math.floor((mins % (60 * 24)) / 60);
  const minutes = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function rupees(value: number | null | undefined) {
  if (value == null) return "—";
  return `Rs.${Math.round(value).toLocaleString("en-IN")}`;
}

function percent(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function badgeClass(classification: string) {
  if (classification === "Delivered") return "bg-emerald-100 text-emerald-800";
  if (classification === "Not delivered") return "bg-amber-100 text-amber-800";
  if (classification === "Pending") return "bg-blue-100 text-blue-800";
  if (classification === "Returned") return "bg-orange-100 text-orange-800";
  return "bg-slate-100 text-slate-700";
}

export function TechnicianPerformanceReport() {
  const initial = previousMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [view, setView] = useState<View>("assigned");
  const [technicianId, setTechnicianId] = useState("");
  const [appliance, setAppliance] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("serviceValue");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
      view,
    });
    if (technicianId) params.set("technicianId", technicianId);
    if (appliance) params.set("appliance", appliance);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (query.trim()) params.set("q", query.trim());

    const handle = setTimeout(() => {
      setLoading(true);
      setError("");
      fetch(`/api/admin/reports/technician-performance?${params}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Failed to load report");
          setReport(data as Report);
        })
        .catch((err: unknown) => {
          setReport(null);
          setError(err instanceof Error ? err.message : "Failed to load report");
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(handle);
  }, [year, month, view, technicianId, appliance, status, from, to, query]);

  const rows = useMemo(() => {
    const list = [...(report?.technicians ?? [])];
    list.sort((a, b) => {
      if (sort === "pendingJobs") return a.pendingJobs - b.pendingJobs;
      if (sort === "averageCompletionMs") {
        if (a.averageCompletionMs == null) return 1;
        if (b.averageCompletionMs == null) return -1;
        return a.averageCompletionMs - b.averageCompletionMs;
      }
      const av = a[sort] ?? -1;
      const bv = b[sort] ?? -1;
      return Number(bv) - Number(av);
    });
    return list;
  }, [report, sort]);

  const maxCompleted = Math.max(1, ...rows.map((row) => row.jobsCompleted));
  const maxValue = Math.max(1, ...rows.map((row) => row.serviceValue));
  const maxTime = Math.max(
    1,
    ...rows.map((row) => row.averageCompletionMs ?? 0)
  );
  const maxTrend = Math.max(1, ...(report?.trend.map((item) => item.serviceValue) ?? [1]));
  const exportParams = new URLSearchParams({
    year: String(year),
    month: String(month),
    view,
    format: "excel",
  });
  if (technicianId) exportParams.set("technicianId", technicianId);
  if (appliance) exportParams.set("appliance", appliance);
  if (status) exportParams.set("status", status);
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  if (query.trim()) exportParams.set("q", query.trim());

  const thisYear = new Date(Date.now() + IST_OFFSET_MS).getUTCFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3, thisYear - 4];

  return (
    <div id="technician-performance" className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap gap-2">
          <select
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            aria-label="Month"
          >
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {new Date(Date.UTC(2026, index, 1)).toLocaleString("en-IN", {
                  month: "long",
                  timeZone: "UTC",
                })}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            aria-label="Year"
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={view}
            onChange={(event) => setView(event.target.value as View)}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            aria-label="Report view"
          >
            <option value="assigned">Jobs received this month</option>
            <option value="completed">Jobs completed this month</option>
          </select>
          <select
            value={technicianId}
            onChange={(event) => setTechnicianId(event.target.value)}
            className="h-9 min-w-36 rounded-md border border-slate-300 bg-white px-2 text-sm"
            aria-label="Technician"
          >
            <option value="">All technicians</option>
            <option value="__unassigned__">Unassigned</option>
            {(report?.technicianOptions ?? []).map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name}
              </option>
            ))}
          </select>
          <select
            value={appliance}
            onChange={(event) => setAppliance(event.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            aria-label="Product type"
          >
            <option value="">All products</option>
            {(report?.appliances ?? []).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-9 rounded-md border border-slate-300 px-2 text-sm"
            aria-label="From date"
          />
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-9 rounded-md border border-slate-300 px-2 text-sm"
            aria-label="To date"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Job, customer, or product"
            className="h-9 min-w-48 flex-1 rounded-md border border-slate-300 px-2 text-sm"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          <a
            href={`/api/admin/reports/technician-performance?${exportParams}`}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Download Excel
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Print / PDF
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {loading && !report && (
        <p className="text-center text-sm text-slate-500">Loading performance…</p>
      )}

      {report && (
        <>
          <p className="text-sm text-slate-600">
            {report.rangeLabel}
            {view === "assigned"
              ? " · jobs received in this period, shown with their latest status"
              : " · jobs marked Ready in this period, including work received earlier"}
            {loading ? " · updating…" : ""}
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Kpi label="Jobs" value={String(report.summary.totalJobs)} tone="text-slate-900" />
            <Kpi label="Completed" value={String(report.summary.completed)} tone="text-emerald-700" />
            <Kpi label="Delivered" value={String(report.summary.delivered)} tone="text-emerald-800" />
            <Kpi label="Not delivered" value={String(report.summary.notDelivered)} tone="text-amber-700" />
            <Kpi label="Pending" value={String(report.summary.pending)} tone="text-blue-700" />
            <Kpi label="Returned" value={String(report.summary.returned)} tone="text-orange-700" />
            <Kpi label="Service value" value={rupees(report.summary.serviceValue)} tone="text-slate-900" />
            <Kpi
              label="Avg bench time"
              value={formatDuration(report.summary.averageCompletionMs)}
              tone="text-slate-900"
            />
            <Kpi
              label="In progress"
              value="Not tracked"
              tone="text-slate-500"
            />
          </div>
          <p className="text-xs text-slate-500">
            Median bench time {formatDuration(report.summary.medianCompletionMs)}.
            Deleted jobs excluded: {report.summary.deleted}. Jobs missing a service value:{" "}
            {report.summary.jobsMissingValue}. In progress is not a stored status.
            Returned can overlap with delivered when the same job was later closed.
          </p>

          <section className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="Completed jobs">
              {rows.map((row) => (
                <Bar key={row.id} label={row.name} value={row.jobsCompleted} max={maxCompleted} />
              ))}
            </ChartCard>
            <ChartCard title="Service value">
              {rows.map((row) => (
                <Bar
                  key={row.id}
                  label={row.name}
                  valueLabel={rupees(row.serviceValue)}
                  value={row.serviceValue}
                  max={maxValue}
                />
              ))}
            </ChartCard>
            <ChartCard title="Pending, completed, delivered">
              <Stacked
                pending={report.summary.pending}
                completed={report.summary.completed}
                delivered={report.summary.delivered}
              />
            </ChartCard>
            <ChartCard title="Service value by completion month">
              {report.trend.map((item) => (
                <Bar
                  key={item.label}
                  label={item.label}
                  valueLabel={`${rupees(item.serviceValue)} · ${item.completed}`}
                  value={item.serviceValue}
                  max={maxTrend}
                />
              ))}
            </ChartCard>
            <ChartCard title="Average bench time">
              {rows.map((row) => (
                <Bar
                  key={row.id}
                  label={row.name}
                  valueLabel={formatDuration(row.averageCompletionMs)}
                  value={row.averageCompletionMs ?? 0}
                  max={maxTime}
                />
              ))}
            </ChartCard>
            <ChartCard title="Return rate">
              {rows.map((row) => (
                <Bar
                  key={row.id}
                  label={row.name}
                  valueLabel={percent(row.returnRate)}
                  value={(row.returnRate ?? 0) * 100}
                  max={100}
                />
              ))}
            </ChartCard>
          </section>

          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Technician performance</h3>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
              aria-label="Sort technicians"
            >
              {SORTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-[920px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {[
                    "Technician",
                    "Assigned",
                    "Completed",
                    "Delivered",
                    "Not delivered",
                    "Pending",
                    "Returned",
                    "Cancelled",
                    "Value",
                    "Avg value",
                    "Avg time",
                    "Fastest",
                    "Slowest",
                    "Completion",
                    "Delivery",
                  ].map((heading) => (
                    <th key={heading} className="px-2 py-2 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-3 py-6 text-center text-slate-500">
                      No jobs for this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => setTechnicianId(row.id)}
                          className="font-semibold text-emerald-800 hover:underline"
                        >
                          {row.name}
                        </button>
                      </td>
                      <td className="px-2 py-2">{row.jobsAssigned}</td>
                      <td className="px-2 py-2">{row.jobsCompleted}</td>
                      <td className="px-2 py-2">{row.jobsDelivered}</td>
                      <td className="px-2 py-2">{row.notDelivered}</td>
                      <td className="px-2 py-2">{row.pendingJobs}</td>
                      <td className="px-2 py-2">{row.returnedJobs}</td>
                      <td className="px-2 py-2">{row.cancelledJobs}</td>
                      <td className="px-2 py-2">{rupees(row.serviceValue)}</td>
                      <td className="px-2 py-2">{rupees(row.averageServiceValue)}</td>
                      <td className="px-2 py-2">{formatDuration(row.averageCompletionMs)}</td>
                      <td className="px-2 py-2">{formatDuration(row.fastestMs)}</td>
                      <td className="px-2 py-2">{formatDuration(row.slowestMs)}</td>
                      <td className="px-2 py-2">{percent(row.completionRate)}</td>
                      <td className="px-2 py-2">{percent(row.deliveryRate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {technicianId && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Job history</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-[980px] w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {[
                        "Job",
                        "Customer",
                        "Product",
                        "Received",
                        "Ready",
                        "Delivered",
                        "Value",
                        "Labour",
                        "Spares",
                        "Status",
                        "Bench time",
                        "Return",
                      ].map((heading) => (
                        <th key={heading} className="px-2 py-2 font-medium">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.jobs.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-3 py-6 text-center text-slate-500">
                          No jobs for this technician.
                        </td>
                      </tr>
                    ) : (
                      report.jobs.map((job) => (
                        <tr key={job.id} className="border-t border-slate-100">
                          <td className="px-2 py-2">
                            <Link
                              href={`/jobs/${job.id}`}
                              prefetch={false}
                              className="font-semibold text-emerald-800 hover:underline"
                            >
                              {job.jobNumber}
                            </Link>
                            {job.multipleTechnicians && (
                              <p className="text-[10px] text-amber-700">Two technicians</p>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <p>{job.customerName}</p>
                            <p className="text-slate-500">{job.customerPhone}</p>
                          </td>
                          <td className="px-2 py-2">
                            <p>{job.product}</p>
                            <p className="text-slate-500">{job.complaint}</p>
                          </td>
                          <td className="px-2 py-2">{formatIstDate(job.receivedAt)}</td>
                          <td className="px-2 py-2">{formatIstDate(job.readyAt)}</td>
                          <td className="px-2 py-2">{formatIstDate(job.deliveredAt)}</td>
                          <td className="px-2 py-2">
                            {job.valueMissing ? "Missing" : rupees(job.serviceValue)}
                          </td>
                          <td className="px-2 py-2">{job.labour == null ? "—" : rupees(job.labour)}</td>
                          <td className="px-2 py-2">{job.spares == null ? "—" : rupees(job.spares)}</td>
                          <td className="px-2 py-2">
                            <span className={`rounded-full px-2 py-0.5 ${badgeClass(job.classification)}`}>
                              {job.classification}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {formatDuration(job.benchMs)}
                            {job.grossMs != null && job.benchMs != null && job.grossMs !== job.benchMs && (
                              <p className="text-[10px] text-slate-500">
                                Gross {formatDuration(job.grossMs)}
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-2">{job.returned ? "Yes" : "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <details className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-800">
              How these numbers are counted
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {report.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`text-lg font-bold leading-tight ${tone}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Bar({
  label,
  value,
  max,
  valueLabel,
}: {
  label: string;
  value: number;
  max: number;
  valueLabel?: string;
}) {
  const width = max > 0 ? Math.max(value > 0 ? 4 : 0, (value / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-xs">
      <span className="truncate text-slate-700">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-slate-100">
        <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${width}%` }} />
      </span>
      <span className="text-slate-600">{valueLabel ?? value}</span>
    </div>
  );
}

function Stacked({
  pending,
  completed,
  delivered,
}: {
  pending: number;
  completed: number;
  delivered: number;
}) {
  const total = Math.max(1, pending + completed + delivered);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        <span className="bg-blue-500" style={{ width: `${(pending / total) * 100}%` }} />
        <span className="bg-emerald-500" style={{ width: `${(completed / total) * 100}%` }} />
        <span className="bg-slate-500" style={{ width: `${(delivered / total) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-600">
        Pending {pending} · Completed {completed} · Delivered {delivered}
      </p>
      <p className="text-[10px] text-slate-400">
        Delivered is also inside completed, so this bar is a comparison, not a split of one total.
      </p>
    </div>
  );
}
