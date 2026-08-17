import { after, NextRequest, NextResponse } from "next/server";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  accessoryNames,
  generateJobNumber,
  normalizeMobile,
  normalizeJobNumberQuery,
  detectSearchQueryType,
  parseAccessories,
  parseOptionalDateInput,
  serializeAccessories,
  staffActorName,
} from "@/lib/jobs";
import {
  getDefaultTechnicianForAppliance,
  isBrandAllowedForAppliance,
  isComplaintAllowedForAppliance,
  validateAccessoriesForAppliance,
} from "@/lib/lookups";
import { runPostJobCreateTasks } from "@/lib/job-create-background";
import { canCreateJob } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { ACTIVE_JOB_STATUSES, TECH_MY_BOARD_STATUSES, WARRANTY_JOB_STATUSES, warrantyFieldsSupported } from "@/lib/prisma-statuses";
import { MAX_PRODUCT_PHOTOS, MAX_WARRANTY_CARD_PHOTOS } from "@/lib/constants";
import { getJobListSelect } from "@/lib/job-selects";
import {
  isSupabaseStorageConfigured,
  uploadProductPhotoBuffers,
  uploadWarrantyCardPhotoBuffers,
  type PhotoBufferPayload,
} from "@/lib/supabase-storage";

export async function GET(request: NextRequest) {
  try {
    return await listJobs(request);
  } catch (error) {
    console.error("[GET /api/jobs]", error);
    const message =
      error instanceof Error ? error.message : "Failed to load jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function listJobs(request: NextRequest) {
  const session = await getSession();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status");
  const activeOnly = searchParams.get("active") === "true";
  const deliveryOnly = searchParams.get("delivery") === "true";
  const scopeParam = searchParams.get("scope");
  const warrantyBrand = searchParams.get("warrantyBrand")?.trim() ?? "";
  const warrantyOnly = searchParams.get("warranty") === "true";

  const where: Record<string, unknown> = {};

  const isTechnicianMyScope =
    session.isLoggedIn &&
    session.role === "technician" &&
    Boolean(session.technicianId) &&
    scopeParam !== "all";

  if (session.isLoggedIn && session.role === "technician" && session.technicianId) {
    if (isTechnicianMyScope) {
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
  } else if (warrantyOnly) {
    if (!warrantyFieldsSupported() || WARRANTY_JOB_STATUSES.length === 0) {
      return NextResponse.json([]);
    }
    where.status = { in: WARRANTY_JOB_STATUSES };
    where.isWarranty = true;
  } else if (activeOnly) {
    if (isTechnicianMyScope) {
      if (TECH_MY_BOARD_STATUSES.length === 0) {
        return NextResponse.json([]);
      }
      where.status = { in: TECH_MY_BOARD_STATUSES };
    } else if (ACTIVE_JOB_STATUSES.length === 0) {
      return NextResponse.json([]);
    } else {
      where.status = { in: ACTIVE_JOB_STATUSES };
    }
  }

  if (warrantyBrand) {
    where.brand = warrantyBrand;
    if (warrantyFieldsSupported()) {
      where.isWarranty = true;
    }
  }

  const outsourcedToId = searchParams.get("outsourcedToId")?.trim();
  if (outsourcedToId) {
    where.outsourcedToId = outsourcedToId;
  }

  const isMobileSearch = detectSearchQueryType(q) === "mobile";
  const pageParam = searchParams.get("page");
  const paginate = pageParam != null;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const limit = paginate
    ? Math.min(100, Math.max(1, parsedLimit || 25))
    : isMobileSearch
      ? 100
      : 50;

  // My Jobs / active board: Pending & Waiting first (alpha), then Ready/Return; oldest received first within each.
  const orderBy = deliveryOnly && !q
    ? [{ readyAt: "desc" as const }]
    : activeOnly
      ? [{ status: "asc" as const }, { receivedAt: "asc" as const }]
      : [{ receivedAt: "desc" as const }];

  if (paginate) {
    const [total, jobs] = await Promise.all([
      prisma.jobCard.count({ where }),
      prisma.jobCard.findMany({
        where,
        select: getJobListSelect(),
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      items: jobs,
      total,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }

  const jobs = await prisma.jobCard.findMany({
    where,
    select: getJobListSelect(),
    orderBy,
    take: limit,
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
  try {
    return await createJob(request);
  } catch (error) {
    console.error("[job-create]", error);
    const message =
      error instanceof Error ? error.message : "Failed to create job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function createJob(request: NextRequest) {
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
  let warrantyCardPhotoFiles: File[] = [];
  let accessoriesList: ReturnType<typeof parseAccessories> = [];
  let isWarranty = false;
  let warrantyPurchaseDateRaw: unknown;
  let allowWhatsappNotifications = true;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    mobile = String(form.get("mobile") ?? "");
    customerName = String(form.get("customerName") ?? "");
    applianceType = String(form.get("applianceType") ?? "");
    brand = String(form.get("brand") ?? "");
    model = String(form.get("model") ?? "");
    complaint = String(form.get("complaint") ?? "");
    physicalCondition = String(form.get("physicalCondition") ?? "");
    isWarranty =
      String(form.get("isWarranty") ?? "").toLowerCase() === "true" ||
      String(form.get("isWarranty") ?? "") === "1";
    warrantyPurchaseDateRaw = form.get("warrantyPurchaseDate");
    const whatsappRaw = String(form.get("allowWhatsappNotifications") ?? "true").toLowerCase();
    allowWhatsappNotifications = whatsappRaw === "true" || whatsappRaw === "1";
    const accessoriesRaw = form.get("accessories");
    if (typeof accessoriesRaw === "string" && accessoriesRaw.trim()) {
      accessoriesList = parseAccessories(accessoriesRaw);
    }
    photoFiles = form
      .getAll("photos")
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, MAX_PRODUCT_PHOTOS);
    if (isWarranty) {
      warrantyCardPhotoFiles = form
        .getAll("warrantyCardPhotos")
        .filter((f): f is File => f instanceof File && f.size > 0)
        .slice(0, MAX_WARRANTY_CARD_PHOTOS);
    }
  } else {
    const body = await request.json();
    mobile = body.mobile ?? "";
    customerName = body.customerName ?? "";
    applianceType = body.applianceType ?? "";
    brand = body.brand ?? "";
    model = body.model ?? "";
    complaint = body.complaint ?? "";
    physicalCondition = body.physicalCondition ?? "";
    isWarranty = Boolean(body.isWarranty);
    warrantyPurchaseDateRaw = body.warrantyPurchaseDate;
    allowWhatsappNotifications =
      body.allowWhatsappNotifications === undefined
        ? true
        : Boolean(body.allowWhatsappNotifications);
    if (body.accessories !== undefined) {
      accessoriesList = parseAccessories(
        typeof body.accessories === "string"
          ? body.accessories
          : JSON.stringify(body.accessories)
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
      accessoryNames(accessoriesList)
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
      {
        error:
          "Photo upload is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server, and create a public Storage bucket (product-photos).",
      },
      { status: 503 }
    );
  }

  if (warrantyCardPhotoFiles.length > 0) {
    if (!isWarranty) {
      return NextResponse.json(
        { error: "Warranty card photos apply only to warranty jobs" },
        { status: 400 }
      );
    }
    if (!isSupabaseStorageConfigured()) {
      return NextResponse.json(
        {
          error:
            "Photo upload is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server, and create a public Storage bucket (product-photos).",
        },
        { status: 503 }
      );
    }
  }

  let warrantyPurchaseDate: Date | null = null;
  if (isWarranty && warrantyPurchaseDateRaw != null && warrantyPurchaseDateRaw !== "") {
    const parsed = parseOptionalDateInput(warrantyPurchaseDateRaw);
    if (parsed === undefined) {
      return NextResponse.json(
        { error: "Invalid purchase date" },
        { status: 400 }
      );
    }
    warrantyPurchaseDate = parsed;
  }

  const creatorName = staffActorName(session);
  const brandName = brand.trim();

  const [customer, jobNumber, defaultTech] = await Promise.all([
    prisma.customer.upsert({
      where: { mobile: normalizedMobile },
      update: {
        name: customerName.trim(),
        allowWhatsappNotifications,
      },
      create: {
        mobile: normalizedMobile,
        name: customerName.trim(),
        allowWhatsappNotifications,
      },
    }),
    generateJobNumber(),
    isWarranty ? Promise.resolve(null) : getDefaultTechnicianForAppliance(applianceType),
  ]);

  const assignedTechnicianId = isWarranty ? null : defaultTech?.id ?? null;

  const assignedTechName = defaultTech?.name ?? null;

  const initialStatus = isWarranty ? "WarrantyPending" : "Pending";
  const createNote = isWarranty
    ? `Warranty job created by ${creatorName} — ${brandName}`
    : assignedTechName
      ? `Job card created by ${creatorName} — assigned to ${assignedTechName}`
      : `Job card created by ${creatorName}`;

  let productPhotosJson: string | null = null;
  let warrantyCardPhotosJson: string | null = null;

  if (photoFiles.length > 0 || warrantyCardPhotoFiles.length > 0) {
    try {
      if (photoFiles.length > 0) {
        const urls = await uploadProductPhotoBuffers(
          await readPhotoBuffers(photoFiles),
          jobNumber
        );
        productPhotosJson = JSON.stringify(urls);
      }
      if (warrantyCardPhotoFiles.length > 0) {
        const urls = await uploadWarrantyCardPhotoBuffers(
          await readPhotoBuffers(warrantyCardPhotoFiles),
          jobNumber
        );
        warrantyCardPhotosJson = JSON.stringify(urls);
      }
    } catch (error) {
      console.error("[job-create] Photo upload failed", error);
      const message =
        error instanceof Error ? error.message : "Photo upload failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const job = await prisma.jobCard.create({
    data: {
      jobNumber,
      customerId: customer.id,
      applianceType,
      brand: brandName,
      model: model?.trim() || null,
      complaint,
      physicalCondition: physicalCondition?.trim() || null,
      accessories: serializeAccessories(accessoriesList),
      productPhotos: productPhotosJson,
      warrantyCardPhotos: warrantyCardPhotosJson,
      status: initialStatus,
      assignedTechnicianId,
      isWarranty,
      warrantyPurchaseDate: isWarranty ? warrantyPurchaseDate : null,
      whatsappNotificationsOverride: allowWhatsappNotifications ? null : false,
      createdBy: creatorName,
      statusHistory: {
        create: {
          status: initialStatus,
          changedBy: creatorName,
          note: createNote,
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
    await runPostJobCreateTasks({
      jobId: job.id,
      jobNumber,
      applianceType,
      brand,
      complaint,
      photos: [],
      warrantyCardPhotos: [],
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
