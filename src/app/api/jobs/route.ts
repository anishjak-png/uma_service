import { NextRequest, NextResponse } from "next/server";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  generateJobNumber,
  normalizeMobile,
  recordStatusChange,
} from "@/lib/jobs";
import {
  ensureLookupOption,
  getDefaultTechnicianForAppliance,
} from "@/lib/lookups";
import { enqueueReceiptPrint } from "@/lib/print-queue";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status");
  const activeOnly = searchParams.get("active") === "true";
  const pendingForTechnician = searchParams.get("pendingForTechnician");
  const technicianId = searchParams.get("technicianId");

  const where: Record<string, unknown> = {};

  if (q) {
    const mobile = normalizeMobile(q);
    where.OR = [
      { jobNumber: { contains: q.toUpperCase() } },
      { customer: { mobile: { contains: mobile } } },
      { customer: { name: { contains: q } } },
    ];
  }

  if (pendingForTechnician === "true") {
    where.status = { in: ["Received", "Diagnosing", "InRepair"] };
    if (technicianId) {
      where.assignedTechnicianId = technicianId;
    }
  } else if (status && status !== "all") {
    where.status = status as JobStatus;
  } else if (activeOnly) {
    where.status = { in: ["Received", "Diagnosing", "InRepair", "Ready"] };
  }

  const jobs = await prisma.jobCard.findMany({
    where,
    include: {
      customer: true,
      assignedTechnician: true,
      attendedTechnician: true,
    },
    orderBy: { receivedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(jobs);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  const body = await request.json();

  const mobile = normalizeMobile(body.mobile ?? "");
  if (mobile.length !== 10) {
    return NextResponse.json({ error: "Valid 10-digit mobile required" }, { status: 400 });
  }

  if (!body.applianceType || !body.complaint) {
    return NextResponse.json(
      { error: "Appliance type and complaint required" },
      { status: 400 }
    );
  }

  await Promise.all([
    ensureLookupOption("appliance", body.applianceType),
    body.brand ? ensureLookupOption("brand", body.brand) : Promise.resolve(),
    ensureLookupOption("complaint", body.complaint),
  ]);

  const defaultTech = await getDefaultTechnicianForAppliance(body.applianceType);

  const customer = await prisma.customer.upsert({
    where: { mobile },
    update: {
      name: body.customerName || undefined,
      address: body.address || undefined,
    },
    create: {
      mobile,
      name: body.customerName || null,
      address: body.address || null,
    },
  });

  const jobNumber = await generateJobNumber();

  const job = await prisma.jobCard.create({
    data: {
      jobNumber,
      customerId: customer.id,
      applianceType: body.applianceType,
      brand: body.brand || null,
      model: body.model || null,
      complaint: body.complaint,
      assignedTechnicianId: defaultTech?.id ?? body.assignedTechnicianId ?? null,
      createdBy: session.role ?? "reception",
      statusHistory: {
        create: {
          status: "Received",
          changedBy: session.role ?? "reception",
          note: defaultTech
            ? `Job card created — assigned to ${defaultTech.name}`
            : "Job card created",
        },
      },
    },
    include: {
      customer: true,
      assignedTechnician: true,
      attendedTechnician: true,
      statusHistory: true,
    },
  });

  await enqueueReceiptPrint(job.id);

  return NextResponse.json(job, { status: 201 });
}
