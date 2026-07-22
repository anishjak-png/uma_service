import { prisma } from "@/lib/db";
import { ensureLookupOption, type LookupCategory } from "@/lib/lookups";
import { enqueueReceiptPrint } from "@/lib/print-queue";
import {
  uploadProductPhotoBuffers,
  type PhotoBufferPayload,
} from "@/lib/supabase-storage";

export type PostJobCreatePayload = {
  jobId: string;
  jobNumber: string;
  applianceType: string;
  brand: string;
  complaint: string;
  photos: PhotoBufferPayload[];
};

/** Non-critical work deferred until after the job-create response is sent. */
export async function runPostJobCreateTasks(payload: PostJobCreatePayload) {
  const { jobId, jobNumber, applianceType, brand, complaint, photos } = payload;

  const lookupTasks = (
    [
      ["appliance", applianceType],
      ["brand", brand],
      ["complaint", complaint],
    ] as const
  ).map(([category, value]) => ensureLookupOption(category as LookupCategory, value));

  await Promise.allSettled([
    ...lookupTasks,
    enqueueReceiptPrint(jobId),
    photos.length > 0
      ? uploadProductPhotoBuffers(photos, jobNumber)
          .then((urls) =>
            prisma.jobCard.update({
              where: { id: jobId },
              data: { productPhotos: JSON.stringify(urls) },
            })
          )
          .catch((err) => {
            console.error(`[job-create] Photo upload failed for ${jobNumber}:`, err);
          })
      : Promise.resolve(),
  ]);
}
