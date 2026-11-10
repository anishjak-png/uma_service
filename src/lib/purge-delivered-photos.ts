import { PHOTO_RETENTION_DAYS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { parsePhotoUrls } from "@/lib/jobs";
import {
  deleteStoredPhotos,
  isSupabaseStorageConfigured,
  storedPhotoPath,
} from "@/lib/supabase-storage";

const BATCH = 200;

function keptUrls(urls: string[], removed: Set<string>): string[] {
  return urls.filter((url) => !removed.has(url));
}

/**
 * Delete product and warranty-card photos for jobs that are still Delivered
 * and were delivered at least PHOTO_RETENTION_DAYS ago. Reopened jobs are skipped
 * because delivery clears deliveredAt.
 */
export async function purgeDeliveredPhotos() {
  const cutoff = new Date(Date.now() - PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const jobs = await prisma.jobCard.findMany({
    where: {
      status: "Delivered",
      deliveredAt: { lte: cutoff },
      OR: [
        { productPhotos: { not: null } },
        { warrantyCardPhotos: { not: null } },
      ],
    },
    select: {
      id: true,
      jobNumber: true,
      productPhotos: true,
      warrantyCardPhotos: true,
    },
    orderBy: { deliveredAt: "asc" },
    take: BATCH,
  });

  const plans = jobs.map((job) => ({
    id: job.id,
    jobNumber: job.jobNumber,
    product: parsePhotoUrls(job.productPhotos),
    warranty: parsePhotoUrls(job.warrantyCardPhotos),
  }));

  const urlsToDelete = new Set<string>();
  const paths: string[] = [];
  for (const plan of plans) {
    for (const url of [...plan.product, ...plan.warranty]) {
      const path = storedPhotoPath(url);
      if (!path || urlsToDelete.has(url)) continue;
      urlsToDelete.add(url);
      paths.push(path);
    }
  }

  const hasUnmapped = plans.some((plan) =>
    [...plan.product, ...plan.warranty].some((url) => !storedPhotoPath(url))
  );
  if ((paths.length > 0 || hasUnmapped) && !isSupabaseStorageConfigured()) {
    throw new Error("Supabase Storage is not configured");
  }

  if (paths.length > 0) {
    await deleteStoredPhotos(paths);
  }

  const clearIds: string[] = [];
  const partial: { id: string; productPhotos: string | null; warrantyCardPhotos: string | null }[] =
    [];

  for (const plan of plans) {
    const product = keptUrls(plan.product, urlsToDelete);
    const warranty = keptUrls(plan.warranty, urlsToDelete);
    if (product.length === 0 && warranty.length === 0) {
      clearIds.push(plan.id);
    } else {
      partial.push({
        id: plan.id,
        productPhotos: product.length ? JSON.stringify(product) : null,
        warrantyCardPhotos: warranty.length ? JSON.stringify(warranty) : null,
      });
    }
  }

  if (clearIds.length > 0) {
    await prisma.jobCard.updateMany({
      where: { id: { in: clearIds } },
      data: { productPhotos: null, warrantyCardPhotos: null },
    });
  }

  for (const row of partial) {
    await prisma.jobCard.update({
      where: { id: row.id },
      data: {
        productPhotos: row.productPhotos,
        warrantyCardPhotos: row.warrantyCardPhotos,
      },
    });
  }

  return {
    scanned: jobs.length,
    jobsCleared: clearIds.length + partial.length,
    filesDeleted: paths.length,
    moreRemaining: jobs.length === BATCH,
  };
}
