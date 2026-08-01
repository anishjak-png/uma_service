import { NextRequest, NextResponse } from "next/server";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ACTIVE_JOB_STATUSES, WARRANTY_JOB_STATUSES, warrantyFieldsSupported } from "@/lib/prisma-statuses";
import {
  detectSearchQueryType,
  normalizeJobNumberQuery,
  normalizeMobile,
} from "@/lib/jobs";
import { getJobListSelect } from "@/lib/job-selects";
import { daysAgo, getPeriodRange, type ReportPeriod } from "@/lib/reports";
import { getSession } from "@/lib/session";

function technicianScopeWhere(
  session: Awaited<ReturnType<typeof getSession>>,
  scopeParam: string | null
) {
  if (
    session.isLoggedIn &&
    session.role === "technician" &&
    session.technicianId &&
    scopeParam !== "all"
  ) {
    return { assignedTechnicianId: session.technicianId };
  }
  return {};
}

function parseReportPeriod(raw: string | null): ReportPeriod | null {
  if (raw === "today" || raw === "month" || raw === "year") return raw;
  return null;
}

async function browseJobsResponse(params: {
  session: Awaited<ReturnType<typeof getSession>>;
  scopeWhere: Record<string, unknown>;
  status: string | null;
  technicianId: string | null;
  applianceType: string | null;
  brand: string | null;
  minAgeDays: string | null;
  activeOnly: boolean;
  receivedPeriod: ReportPeriod | null;
  deliveredPeriod: ReportPeriod | null;
  readyPeriod: ReportPeriod | null;
  completedByTechnicianId: string | null;
  outsourcedToId: string | null;
  warrantyBrand: string | null;
  warrantyOnly: boolean;
}) {
  const {
    session,
    scopeWhere,
    status,
    technicianId,
    applianceType,
    brand,
    minAgeDays,
    activeOnly,
    receivedPeriod,
    deliveredPeriod,
    readyPeriod,
    completedByTechnicianId,
    outsourcedToId,
    warrantyBrand,
    warrantyOnly,
  } = params;

  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where: Record<string, unknown> = { ...scopeWhere };

  if (status && status !== "all") {
    where.status = status as JobStatus;
  } else if (warrantyOnly) {
    if (!warrantyFieldsSupported() || WARRANTY_JOB_STATUSES.length === 0) {
      return NextResponse.json({
        mode: "jobs",
        searchType: "browse",
        customer: null,
        jobs: [],
      });
    }
    where.status = { in: WARRANTY_JOB_STATUSES };
    where.isWarranty = true;
  } else if (activeOnly) {
    if (ACTIVE_JOB_STATUSES.length === 0) {
      return NextResponse.json({
        mode: "jobs",
        searchType: "browse",
        customer: null,
        jobs: [],
      });
    }
    where.status = { in: ACTIVE_JOB_STATUSES };
  }

  if (technicianId) {
    where.assignedTechnicianId = technicianId;
  }

  if (completedByTechnicianId) {
    where.completedByTechnicianId = completedByTechnicianId;
  }

  if (outsourcedToId) {
    where.outsourcedToId = outsourcedToId;
  }

  if (warrantyBrand) {
    where.brand = warrantyBrand;
    if (warrantyFieldsSupported()) {
      where.isWarranty = true;
    }
  }

  if (applianceType) {
    where.applianceType = applianceType;
  }

  if (brand && !warrantyBrand) {
    where.brand = brand;
  }

  if (minAgeDays) {
    const days = Number.parseInt(minAgeDays, 10);
    if (!Number.isNaN(days) && days > 0) {
      where.status = "Pending";
      where.receivedAt = { lt: daysAgo(days) };
    }
  }

  if (receivedPeriod) {
    const { start, end } = getPeriodRange(receivedPeriod);
    where.receivedAt = { gte: start, lt: end };
  }

  if (deliveredPeriod) {
    const { start, end } = getPeriodRange(deliveredPeriod);
    where.status = "Delivered";
    where.deliveredAt = { gte: start, lt: end };
  }

  if (readyPeriod) {
    const { start, end } = getPeriodRange(readyPeriod);
    where.readyAt = { gte: start, lt: end };
  }

  const jobs = await prisma.jobCard.findMany({
    where,
    select: getJobListSelect(),
    orderBy: { receivedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    mode: "jobs",
    searchType: "browse",
    customer: null,
    jobs,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await searchJobs(request);
  } catch (error) {
    console.error("[GET /api/jobs/search]", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function searchJobs(request: NextRequest) {
  const session = await getSession();
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const customerId = searchParams.get("customerId");
  const status = searchParams.get("status");
  const scopeParam = searchParams.get("scope");
  const technicianId = searchParams.get("technicianId");
  const applianceType = searchParams.get("applianceType");
  const brand = searchParams.get("brand");
  const minAgeDays = searchParams.get("minAgeDays");
  const activeOnly = searchParams.get("active") === "true";
  const receivedPeriod = parseReportPeriod(searchParams.get("receivedPeriod"));
  const deliveredPeriod = parseReportPeriod(searchParams.get("deliveredPeriod"));
  const readyPeriod = parseReportPeriod(searchParams.get("readyPeriod"));
  const completedByTechnicianId = searchParams.get("completedByTechnicianId");
  const outsourcedToId = searchParams.get("outsourcedToId");
  const warrantyBrand = searchParams.get("warrantyBrand")?.trim() || null;
  const warrantyOnly = searchParams.get("warranty") === "true";

  const scopeWhere = technicianScopeWhere(session, scopeParam);
  const hasBrowseFilter = Boolean(
    (status && status !== "all") ||
      technicianId ||
      applianceType ||
      brand ||
      minAgeDays ||
      activeOnly ||
      receivedPeriod ||
      deliveredPeriod ||
      readyPeriod ||
      completedByTechnicianId ||
      outsourcedToId ||
      warrantyBrand ||
      warrantyOnly
  );

  if (!q && !customerId && hasBrowseFilter) {
    return browseJobsResponse({
      session,
      scopeWhere,
      status: status ?? null,
      technicianId,
      applianceType,
      brand,
      minAgeDays,
      activeOnly,
      receivedPeriod,
      deliveredPeriod,
      readyPeriod,
      completedByTechnicianId,
      outsourcedToId,
      warrantyBrand,
      warrantyOnly,
    });
  }

  const statusWhere =
    status && status !== "all" ? { status: status as JobStatus } : {};
  const outsourceWhere = outsourcedToId ? { outsourcedToId } : {};
  const warrantyWhere = warrantyBrand
    ? {
        brand: warrantyBrand,
        ...(warrantyFieldsSupported() ? { isWarranty: true } : {}),
      }
    : warrantyOnly
      ? warrantyFieldsSupported() && WARRANTY_JOB_STATUSES.length > 0
        ? {
            isWarranty: true,
            status: { in: WARRANTY_JOB_STATUSES },
          }
        : { id: { in: [] } }
      : {};

  async function jobsForCustomer(id: string) {
    return prisma.jobCard.findMany({
      where: {
        customerId: id,
        ...scopeWhere,
        ...statusWhere,
        ...outsourceWhere,
        ...warrantyWhere,
      },
      select: getJobListSelect(),
      orderBy: { receivedAt: "desc" },
    });
  }

  async function totalVisitsForCustomer(id: string) {
    return prisma.jobCard.count({
      where: { customerId: id, ...scopeWhere },
    });
  }

  async function customerJobsResponse(
    customer: { id: string; name: string | null; mobile: string },
    searchType: "mobile" | "name"
  ) {
    const [jobs, totalVisits] = await Promise.all([
      jobsForCustomer(customer.id),
      totalVisitsForCustomer(customer.id),
    ]);
    return NextResponse.json({
      mode: "jobs",
      searchType,
      customer: {
        id: customer.id,
        name: customer.name,
        mobile: customer.mobile,
      },
      totalVisits,
      jobs,
    });
  }

  if (customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, mobile: true },
    });
    if (!customer) {
      return NextResponse.json({
        mode: "jobs",
        searchType: "name",
        customer: null,
        jobs: [],
      });
    }
    return customerJobsResponse(customer, "name");
  }

  if (!q) {
    return NextResponse.json({
      mode: "jobs",
      searchType: "empty",
      customer: null,
      jobs: [],
    });
  }

  const searchType = detectSearchQueryType(q);

  if (searchType === "mobile") {
    const mobile = normalizeMobile(q);
    const customer = await prisma.customer.findUnique({
      where: { mobile },
      select: { id: true, name: true, mobile: true },
    });
    if (!customer) {
      return NextResponse.json({
        mode: "jobs",
        searchType: "mobile",
        customer: null,
        jobs: [],
      });
    }
    return customerJobsResponse(customer, "mobile");
  }

  if (searchType === "ut") {
    const jobNumber = normalizeJobNumberQuery(q);
    const job = await prisma.jobCard.findFirst({
      where: {
        jobNumber,
        ...scopeWhere,
        ...statusWhere,
        ...outsourceWhere,
        ...warrantyWhere,
      },
      select: getJobListSelect(),
    });
    return NextResponse.json({
      mode: "jobs",
      searchType: "ut",
      customer: job
        ? {
            id: job.customer.id,
            name: job.customer.name,
            mobile: job.customer.mobile,
          }
        : null,
      jobs: job ? [job] : [],
    });
  }

  const customers = await prisma.customer.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      mobile: true,
      _count: { select: { jobCards: true } },
    },
    orderBy: { name: "asc" },
    take: 20,
  });

  if (customers.length === 0) {
    return NextResponse.json({
      mode: "jobs",
      searchType: "name",
      customer: null,
      jobs: [],
    });
  }

  if (customers.length === 1) {
    return customerJobsResponse(customers[0], "name");
  }

  return NextResponse.json({
    mode: "customer_pick",
    searchType: "name",
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      mobile: c.mobile,
      jobCount: c._count.jobCards,
    })),
  });
}
