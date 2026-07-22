import { NextRequest, NextResponse } from "next/server";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  detectSearchQueryType,
  normalizeJobNumberQuery,
  normalizeMobile,
} from "@/lib/jobs";
import { jobListSelect } from "@/lib/job-selects";
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

export async function GET(request: NextRequest) {
  const session = await getSession();
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const customerId = searchParams.get("customerId");
  const status = searchParams.get("status");
  const scopeParam = searchParams.get("scope");

  const scopeWhere = technicianScopeWhere(session, scopeParam);
  const statusWhere =
    status && status !== "all" ? { status: status as JobStatus } : {};

  async function jobsForCustomer(id: string) {
    return prisma.jobCard.findMany({
      where: { customerId: id, ...scopeWhere, ...statusWhere },
      select: jobListSelect,
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
      where: { jobNumber, ...scopeWhere, ...statusWhere },
      select: jobListSelect,
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
