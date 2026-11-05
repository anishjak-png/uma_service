import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  formatDuration,
  formatIstDate,
  loadTechnicianPerformance,
  previousIstMonth,
  type PerformanceJob,
  type PerformanceReport,
  type PerformanceView,
} from "@/lib/technician-performance";

function readFilters(request: NextRequest, includeJobs: boolean) {
  const params = request.nextUrl.searchParams;
  const fallback = previousIstMonth();
  const year = Number(params.get("year") ?? fallback.year);
  const month = Number(params.get("month") ?? fallback.month);
  const viewParam = params.get("view");
  const view: PerformanceView = viewParam === "completed" ? "completed" : "assigned";
  return {
    year: Number.isInteger(year) ? year : fallback.year,
    month: month >= 1 && month <= 12 ? month : fallback.month,
    view,
    technicianId: params.get("technicianId") || undefined,
    applianceType: params.get("appliance") || undefined,
    status: params.get("status") || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
    q: params.get("q") || undefined,
    includeJobs,
  };
}

function xml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sheet(name: string, rows: Array<Array<string | number | null>>) {
  const table = rows
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => {
            if (typeof cell === "number") {
              return `<Cell><Data ss:Type="Number">${cell}</Data></Cell>`;
            }
            return `<Cell><Data ss:Type="String">${xml(cell)}</Data></Cell>`;
          })
          .join("")}</Row>`
    )
    .join("");
  return `<Worksheet ss:Name="${xml(name)}"><Table>${table}</Table></Worksheet>`;
}

function jobRow(job: PerformanceJob) {
  return [
    job.jobNumber,
    job.customerName,
    job.customerPhone,
    job.product,
    job.complaint,
    formatIstDate(job.receivedAt),
    formatIstDate(job.readyAt),
    formatIstDate(job.deliveredAt),
    job.assignedTechnician,
    job.completedByTechnician,
    job.multipleTechnicians ? "Yes" : "No",
    job.classification,
    job.status,
    job.serviceValue,
    job.labour,
    job.spares,
    job.valueMissing ? "Missing" : "",
    formatDuration(job.benchMs),
    formatDuration(job.grossMs),
    formatDuration(job.pendingMs),
    job.returned ? "Yes" : "No",
    job.firstTimeCompleted ? "Yes" : "No",
  ];
}

const JOB_HEADER = [
  "Job number",
  "Customer",
  "Phone",
  "Product",
  "Complaint",
  "Complaint date",
  "Completed date",
  "Delivered date",
  "Assigned technician",
  "Completed by",
  "Multiple technicians",
  "Classification",
  "Status",
  "Service value",
  "Labour",
  "Spares",
  "Value missing",
  "Bench completion time",
  "Gross received to ready",
  "Pending duration",
  "Returned",
  "First-time completed",
];

function workbook(report: PerformanceReport) {
  const summaryRows: Array<Array<string | number | null>> = [
    ["Technician performance", report.rangeLabel],
    ["View", report.view === "assigned" ? "Assigned in period" : "Completed in period"],
    ["Total jobs", report.summary.totalJobs],
    ["Completed", report.summary.completed],
    ["Delivered", report.summary.delivered],
    ["Not delivered", report.summary.notDelivered],
    ["Pending", report.summary.pending],
    ["Returned (same job, may overlap)", report.summary.returned],
    ["In progress (not tracked)", report.summary.inProgress],
    ["Deleted (excluded from totals)", report.summary.deleted],
    ["Service value", report.summary.serviceValue],
    ["Jobs missing service value", report.summary.jobsMissingValue],
    ["Average bench completion", formatDuration(report.summary.averageCompletionMs)],
    ["Median bench completion", formatDuration(report.summary.medianCompletionMs)],
    [],
    ["Notes"],
    ...report.notes.map((note) => [note]),
  ];

  const techRows: Array<Array<string | number | null>> = [
    [
      "Technician",
      "Assigned",
      "Completed",
      "First-time completed",
      "Delivered",
      "Not delivered",
      "Pending",
      "Returned",
      "Cancelled",
      "Service value",
      "Average value",
      "Average bench time",
      "Fastest",
      "Slowest",
      "Completion rate",
      "Delivery rate",
      "Return rate",
      "Missing value",
    ],
    ...report.technicians.map((row) => [
      row.name,
      row.jobsAssigned,
      row.jobsCompleted,
      row.firstTimeCompleted,
      row.jobsDelivered,
      row.notDelivered,
      row.pendingJobs,
      row.returnedJobs,
      row.cancelledJobs,
      row.serviceValue,
      row.averageServiceValue,
      formatDuration(row.averageCompletionMs),
      formatDuration(row.fastestMs),
      formatDuration(row.slowestMs),
      row.completionRate,
      row.deliveryRate,
      row.returnRate,
      row.jobsMissingValue,
    ]),
  ];

  const jobs = [JOB_HEADER, ...report.jobs.map(jobRow)];
  const pending = [
    JOB_HEADER,
    ...report.jobs
      .filter(
        (job) =>
          job.status === "Pending" ||
          job.status === "WaitingForCustomerApproval"
      )
      .map(jobRow),
  ];
  const returned = [
    JOB_HEADER,
    ...report.jobs.filter((job) => job.returned).map(jobRow),
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheet("Summary", summaryRows)}
${sheet("Technician Performance", techRows)}
${sheet("Job Details", jobs)}
${sheet("Pending Jobs", pending)}
${sheet("Returned Jobs", returned)}
</Workbook>`;
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const excel = request.nextUrl.searchParams.get("format") === "excel";
  try {
    const report = await loadTechnicianPerformance(readFilters(request, excel || Boolean(request.nextUrl.searchParams.get("technicianId"))));
    if (!excel) {
      return NextResponse.json(report);
    }
    const body = workbook(report);
    const filename = `technician-performance-${report.view}.xls`;
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[technician-performance]", error);
    return NextResponse.json(
      { error: "Failed to build technician performance report" },
      { status: 500 }
    );
  }
}
