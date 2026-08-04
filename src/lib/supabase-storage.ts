import { MAX_PRODUCT_PHOTOS, MAX_WARRANTY_CARD_PHOTOS } from "@/lib/constants";

const MAX_PHOTOS = MAX_PRODUCT_PHOTOS;

function getStorageConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "product-photos";

  if (!url || !key) {
    throw new Error("Supabase Storage is not configured");
  }

  return { url, key, bucket };
}

export type PhotoBufferPayload = {
  buffer: Buffer;
  type: string;
  name: string;
};

async function uploadPhotoBuffersToFolder(
  photos: PhotoBufferPayload[],
  jobNumber: string,
  folder: string,
  maxPhotos: number
): Promise<string[]> {
  const { url, key, bucket } = getStorageConfig();
  const urls: string[] = [];

  for (const photo of photos.slice(0, maxPhotos)) {
    const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeJobNumber = jobNumber.replace(/\s+/g, "-");
    const path = `${safeJobNumber}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": photo.type || "image/jpeg",
        "x-upsert": "false",
      },
      body: new Uint8Array(photo.buffer),
    });

    if (!res.ok) {
      const detail = await res.text();
      let message = detail;
      try {
        const parsed = JSON.parse(detail) as { error?: string; message?: string };
        message = parsed.error ?? parsed.message ?? detail;
      } catch {
        // keep raw text
      }
      const lower = message.toLowerCase();
      if (lower.includes("bucket") && lower.includes("not found")) {
        throw new Error(
          `Photo upload failed: storage bucket "${bucket}" not found. Create it in Supabase Storage (public).`
        );
      }
      if (lower.includes("row-level security") || lower.includes("unauthorized") || res.status === 401) {
        throw new Error(
          "Photo upload failed: check SUPABASE_SERVICE_ROLE_KEY on the server."
        );
      }
      if (res.status === 404) {
        throw new Error(
          `Photo upload failed: storage path or bucket missing (${bucket}).`
        );
      }
      throw new Error(`Photo upload failed: ${message}`);
    }

    urls.push(`${url}/storage/v1/object/public/${bucket}/${path}`);
  }

  return urls;
}

export async function uploadProductPhotoBuffers(
  photos: PhotoBufferPayload[],
  jobNumber: string
): Promise<string[]> {
  return uploadPhotoBuffersToFolder(photos, jobNumber, "product", MAX_PHOTOS);
}

export async function uploadWarrantyCardPhotoBuffers(
  photos: PhotoBufferPayload[],
  jobNumber: string
): Promise<string[]> {
  return uploadPhotoBuffersToFolder(
    photos,
    jobNumber,
    "warranty-card",
    MAX_WARRANTY_CARD_PHOTOS
  );
}

export async function uploadProductPhotos(
  files: File[],
  jobNumber: string
): Promise<string[]> {
  const photos = await Promise.all(
    files.slice(0, MAX_PHOTOS).map(async (file) => ({
      buffer: Buffer.from(await file.arrayBuffer()),
      type: file.type || "image/jpeg",
      name: file.name,
    }))
  );
  return uploadProductPhotoBuffers(photos, jobNumber);
}

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
