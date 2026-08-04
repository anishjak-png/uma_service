import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MAX_WARRANTY_CARD_PHOTOS } from "@/lib/constants";
import { parseWarrantyCardPhotos } from "@/lib/jobs";
import { getSession } from "@/lib/session";
import { canCreateJob } from "@/lib/auth";
import {
  isSupabaseStorageConfigured,
  uploadWarrantyCardPhotoBuffers,
} from "@/lib/supabase-storage";

type RouteContext = { params: Promise<{ id: string }> };

async function readPhotoBuffers(files: File[]) {
  return Promise.all(
    files.map(async (file) => ({
      buffer: Buffer.from(await file.arrayBuffer()),
      type: file.type || "image/jpeg",
      name: file.name,
    }))
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !canCreateJob(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const job = await prisma.jobCard.findFirst({
      where: { OR: [{ id }, { jobNumber: id }] },
      select: {
        id: true,
        jobNumber: true,
        isWarranty: true,
        warrantyCardPhotos: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job.isWarranty) {
      return NextResponse.json(
        { error: "Warranty card photos apply only to warranty jobs" },
        { status: 400 }
      );
    }

    const form = await request.formData();
    const photoFiles = form
      .getAll("photos")
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (photoFiles.length === 0) {
      return NextResponse.json({ error: "No photos provided" }, { status: 400 });
    }

    const existing = parseWarrantyCardPhotos(job.warrantyCardPhotos);
    const remaining = MAX_WARRANTY_CARD_PHOTOS - existing.length;
    if (remaining <= 0) {
      return NextResponse.json(
        { error: `Maximum ${MAX_WARRANTY_CARD_PHOTOS} warranty card photos allowed` },
        { status: 400 }
      );
    }

    const toUpload = photoFiles.slice(0, remaining);
    if (!isSupabaseStorageConfigured()) {
      return NextResponse.json(
        {
          error:
            "Photo upload is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server, and create a public Storage bucket (product-photos).",
        },
        { status: 503 }
      );
    }

    const buffers = await readPhotoBuffers(toUpload);
    const uploaded = await uploadWarrantyCardPhotoBuffers(buffers, job.jobNumber);
    const warrantyCardPhotos = [...existing, ...uploaded];

    await prisma.jobCard.update({
      where: { id: job.id },
      data: { warrantyCardPhotos: JSON.stringify(warrantyCardPhotos) },
    });

    return NextResponse.json({ warrantyCardPhotos });
  } catch (error) {
    console.error("[POST /api/jobs/[id]/warranty-card-photos]", error);
    const message =
      error instanceof Error ? error.message : "Failed to upload warranty card photos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
