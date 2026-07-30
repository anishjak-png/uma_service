import { prisma } from "@/lib/db";
import { ensureApplianceLookupOption } from "@/lib/lookups";
import { enqueueReceiptPrint } from "@/lib/print-queue";
import { dispatchNotificationEventAsync } from "@/lib/notifications/events";
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

  const lookupTasks = [
    ensureApplianceLookupOption("brand", brand, applianceType),
    ensureApplianceLookupOption("complaint", complaint, applianceType),
  ];

  console.log("[Notification] Job created", { jobId, jobNumber });

  // Send WhatsApp first — serverless may freeze once slower background work finishes.
  await dispatchNotificationEventAsync({ type: "JOB_CREATED", jobId });

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
