import { after, NextRequest, NextResponse } from "next/server";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  generateJobNumber,
  normalizeMobile,
  normalizeJobNumberQuery,
  detectSearchQueryType,
  staffActorName,
} from "@/lib/jobs";
import {
  getDefaultTechnicianForAppliance,
  isBrandAllowedForAppliance,
  isComplaintAllowedForAppliance,
  validateAccessoriesForAppliance,
} from "@/lib/lookups";
import { serializeAccessories, parseAccessories } from "@/lib/jobs";
import { runPostJobCreateTasks } from "@/lib/job-create-background";
import { canCreateJob } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { ACTIVE_STATUSES, MAX_PRODUCT_PHOTOS } from "@/lib/constants";
import { jobListSelect } from "@/lib/job-selects";
import {
  isSupabaseStorageConfigured,
  type PhotoBufferPayload,
} from "@/lib/supabase-storage";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status");
  const activeOnly = searchParams.get("active") === "true";
  const deliveryOnly = searchParams.get("delivery") === "true";
  const scopeParam = searchParams.get("scope");

  const where: Record<string, unknown> = {};

  if (session.isLoggedIn && session.role === "technician" && session.technicianId) {
    const scope = scopeParam === "all" ? "all" : "my";
    if (scope === "my") {
      where.assignedTechnicianId = session.technicianId;
    }
  }

  if (q) {
    const searchType = detectSearchQueryType(q);

    if (searchType === "ut") {
      where.jobNumber = normalizeJobNumberQuery(q);
    } else if (searchType === "mobile") {
      where.customer = { mobile: normalizeMobile(q) };
    } else {
      where.OR = [
        { customer: { name: { contains: q, mode: "insensitive" } } },
      ];
    }
  }

  if (status && status !== "all") {
    where.status = status as JobStatus;
  } else if (deliveryOnly) {
    where.status = { in: ["Ready", "Return"] };
  } else if (activeOnly) {
    where.status = { in: [...ACTIVE_STATUSES] };
  }

  const isMobileSearch = detectSearchQueryType(q) === "mobile";

  const jobs = await prisma.jobCard.findMany({
    where,
    select: jobListSelect,
    orderBy: deliveryOnly && !q ? { readyAt: "desc" } : { receivedAt: "desc" },
    take: isMobileSearch ? 100 : 50,
  });

  return NextResponse.json(jobs);
}

async function readPhotoBuffers(files: File[]): Promise<PhotoBufferPayload[]> {
  return Promise.all(
    files.map(async (file) => ({
      buffer: Buffer.from(await file.arrayBuffer()),
      type: file.type || "image/jpeg",
      name: file.name,
    }))
  );
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const session = await getSession();
  if (!session.isLoggedIn || !canCreateJob(session.role)) {
    return NextResponse.json({ error: "Not allowed to create jobs" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let mobile = "";
  let customerName = "";
  let applianceType = "";
  let brand = "";
  let model = "";
  let complaint = "";
  let physicalCondition = "";
  let photoFiles: File[] = [];
  let accessoriesList: string[] = [];

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    mobile = String(form.get("mobile") ?? "");
    customerName = String(form.get("customerName") ?? "");
    applianceType = String(form.get("applianceType") ?? "");
    brand = String(form.get("brand") ?? "");
    model = String(form.get("model") ?? "");
    complaint = String(form.get("complaint") ?? "");
    physicalCondition = String(form.get("physicalCondition") ?? "");
    const accessoriesRaw = form.get("accessories");
    if (typeof accessoriesRaw === "string" && accessoriesRaw.trim()) {
      accessoriesList = parseAccessories(accessoriesRaw);
    }
    photoFiles = form
      .getAll("photos")
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, MAX_PRODUCT_PHOTOS);
  } else {
    const body = await request.json();
    mobile = body.mobile ?? "";
    customerName = body.customerName ?? "";
    applianceType = body.applianceType ?? "";
    brand = body.brand ?? "";
    model = body.model ?? "";
    complaint = body.complaint ?? "";
    physicalCondition = body.physicalCondition ?? "";
    if (Array.isArray(body.accessories)) {
      accessoriesList = body.accessories.filter(
        (a: unknown) => typeof a === "string"
      );
    }
  }

  const normalizedMobile = normalizeMobile(mobile);
  if (normalizedMobile.length !== 10) {
    return NextResponse.json({ error: "Valid 10-digit mobile required" }, { status: 400 });
  }

  if (!customerName?.trim()) {
    return NextResponse.json({ error: "Customer name required" }, { status: 400 });
  }

  if (!applianceType || !brand?.trim() || !complaint) {
    return NextResponse.json(
      { error: "Product type, brand, and complaint required" },
      { status: 400 }
    );
  }

  const [brandAllowed, complaintAllowed] = await Promise.all([
    isBrandAllowedForAppliance(applianceType, brand),
    isComplaintAllowedForAppliance(applianceType, complaint),
  ]);

  if (!brandAllowed) {
    return NextResponse.json(
      { error: "Selected brand is not allowed for this product type" },
      { status: 400 }
    );
  }

  if (!complaintAllowed) {
    return NextResponse.json(
      { error: "Selected complaint is not allowed for this product type" },
      { status: 400 }
    );
  }

  if (accessoriesList.length > 0) {
    const accessoriesValid = await validateAccessoriesForAppliance(
      applianceType,
      accessoriesList
    );
    if (!accessoriesValid) {
      return NextResponse.json(
        { error: "One or more accessories are not allowed for this product type" },
        { status: 400 }
      );
    }
  }

  if (photoFiles.length > 0 && !isSupabaseStorageConfigured()) {
    return NextResponse.json(
      { error: "Photo upload is not configured. Set Supabase Storage env vars." },
      { status: 503 }
    );
  }

  const creatorName = staffActorName(session);

  const [customer, jobNumber, defaultTech] = await Promise.all([
    prisma.customer.upsert({
      where: { mobile: normalizedMobile },
      update: { name: customerName.trim() },
      create: {
        mobile: normalizedMobile,
        name: customerName.trim(),
      },
    }),
    generateJobNumber(),
    getDefaultTechnicianForAppliance(applianceType),
  ]);

  const job = await prisma.jobCard.create({
    data: {
      jobNumber,
      customerId: customer.id,
      applianceType,
      brand: brand.trim(),
      model: model?.trim() || null,
      complaint,
      physicalCondition: physicalCondition?.trim() || null,
      accessories: serializeAccessories(accessoriesList),
      productPhotos: null,
      assignedTechnicianId: defaultTech?.id ?? null,
      createdBy: creatorName,
      statusHistory: {
        create: {
          status: "Pending",
          changedBy: creatorName,
          note: defaultTech
            ? `Job card created by ${creatorName} — assigned to ${defaultTech.name}`
            : `Job card created by ${creatorName}`,
        },
      },
    },
    include: {
      customer: true,
      assignedTechnician: true,
    },
  });

  after(async () => {
    console.log("[Notification] Post-create tasks started", {
      jobId: job.id,
      jobNumber,
    });
    const photoBuffers =
      photoFiles.length > 0 ? await readPhotoBuffers(photoFiles) : [];
    await runPostJobCreateTasks({
      jobId: job.id,
      jobNumber,
      applianceType,
      brand,
      complaint,
      photos: photoBuffers,
    });
  });

  const elapsedMs = Date.now() - startedAt;
  if (process.env.NODE_ENV === "development") {
    console.info(`[job-create] sync path ${elapsedMs}ms job=${jobNumber}`);
  }

  const response = NextResponse.json(job, { status: 201 });
  response.headers.set("Server-Timing", `job-create;dur=${elapsedMs}`);
  return response;
}
